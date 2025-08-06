import express from 'express';
import mongoose from 'mongoose';
import Site from '../models/Site.js';
import Device from '../models/Device.js';

const router = express.Router();
    // Use mongoose.connection everywhere
    const mainDB = mongoose.connection;
    
    // Register Site schema on mainDB to avoid MissingSchemaError
    const siteSchema = new mongoose.Schema({}, { strict: false });
    mainDB.model('Site', siteSchema, 'sites');
    
    mainDB.on('connected', () => console.log('✅ Main DB Connected'));
    mainDB.on('error', (err) => console.error('❌ Main DB Error:', err));
// Helper to get DB name by site ID (using site name)
    async function getSiteDbName(siteId) {
        const site = await Site.findById(siteId);
        if (!site || !site.name) throw new Error(`Site ${siteId} not found or has no name`);
        return site.name.replace(/\s+/g, '_');
    }

    // Routes using corrected DB name from site name
    async function handleStats(req, res, collectionName, valueKey) {
        try {
        const { siteId } = req.params;
        const { granularity = 'day', from, to } = req.query;
        const formatMap = {
            hour: '%Y-%m-%d %H:00:00',
            day: '%Y-%m-%d',
            week: '%Y-%U',
            month: '%Y-%m',
            year: '%Y'
        };
        const format = formatMap[granularity.toLowerCase()] || '%Y-%m-%d';
        const dbName = await getSiteDbName(siteId);
    
        const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
            dbName,
            serverSelectionTimeoutMS: 30000
        });
    
        const SensorModel = siteConnection.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
    
        const match = { [valueKey]: { $exists: true }, deviceId: { $exists: true } };
        if (from || to) {
            match.timestamp = {};
            if (from) match.timestamp.$gte = new Date(from);
            if (to) match.timestamp.$lte = new Date(to);
        }
    
        
    
        const sampleDocs = await SensorModel.find(match).limit(5);
    
    
        const pipeline = [
            { $match: match },
            
            // Convert timestamp to Date if needed (handle string, number, or Date)
            { 
                $addFields: { 
                    timestamp: { 
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                    then: { $dateFromString: { dateString: "$timestamp" } }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                    then: "$timestamp"
                                }
                            ],
                            default: new Date()
                        }
                    }
                }
            },
    
            { $project: { deviceId: 1, value: { $ifNull: [ `$${valueKey}`, 0 ] }, timestamp: 1, period: { $dateToString: { format, date: "$timestamp" } } } },
            { $sort: { deviceId: 1, timestamp: 1 } },
            { $group: { _id: { deviceId: "$deviceId", period: "$period" }, first: { $first: "$value" }, last: { $last: "$value" } } },
            { $project: { period: "$_id.period", deviceId: "$_id.deviceId", delta: { $subtract: ["$last", "$first"] } } },
            { $group: { _id: "$period", total: { $sum: "$delta" } } },
    
            { $sort: { _id: 1 } }
        ];
    
        const result = await SensorModel.aggregate(pipeline);
        await siteConnection.close();
    
        res.status(200).json(result.map(r => ({ period: r._id, totalIndex: r.total })));
        } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        }
    }
    
    async function handleIndex(req, res, collectionName, valueKey) {
        try {
        const { siteId } = req.params;
        const dbName = await getSiteDbName(siteId);
    
        const siteConnection = mongoose.createConnection(process.env.MONGO_URI, { 
            dbName,
            serverSelectionTimeoutMS: 30000
    
        });
    
        const SensorModel = siteConnection.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
    
        const pipeline = [
            { $match: { [valueKey]: { $exists: true }, deviceId: { $exists: true } } },
            
            // Convert timestamp to Date if needed for proper sorting (handle string, number, or Date)
            { 
                $addFields: { 
                    timestamp: { 
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                    then: { $dateFromString: { dateString: "$timestamp" } }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                    then: "$timestamp"
                                }
                            ],
                            default: new Date()
                        }
                    }
                }
            },
            
            { $sort: { deviceId: 1, timestamp: -1 } },
    
            { $group: { _id: "$deviceId", lastReading: { $first: `$${valueKey}` } } },
            { $group: { _id: null, totalIndex: { $sum: "$lastReading" } } }
    
        ];
    
        const result = await SensorModel.aggregate(pipeline);
        await siteConnection.close();
    
        res.status(200).json({ siteId, sensorType: collectionName, totalIndex: result[0]?.totalIndex ?? 0 });
        } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message });
        }
    }
    
    // Handle stats for a single device
    async function handleDeviceStats(req, res, collectionName, valueKey) {
        try {
            const { siteId, deviceId } = req.params;
            const { granularity = 'day', from, to } = req.query;
            
            console.log('🔍 [Device Stats] Request params:', { siteId, deviceId, collectionName, valueKey });
            console.log('🔍 [Device Stats] Request query:', { granularity, from, to });
            console.log('🔍 [Device Stats] Date objects:', { 
                fromDate: from ? new Date(from) : null, 
                toDate: to ? new Date(to) : null 
            });
            const formatMap = {
                hour: '%Y-%m-%d %H:00:00',
                day: '%Y-%m-%d',
                week: '%Y-%U',
                month: '%Y-%m',
                year: '%Y'
            };
            const format = formatMap[granularity.toLowerCase()] || '%Y-%m-%d';
            const dbName = await getSiteDbName(siteId);
            console.log('🔍 [Device Stats] Using database:', dbName);
        
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
                dbName,
                serverSelectionTimeoutMS: 30000
            });
        
            const SensorModel = siteConnection.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
            console.log('🔍 [Device Stats] Using collection:', collectionName);
        
            // Match for specific device
            const match = { 
                [valueKey]: { $exists: true }, 
                deviceId: deviceId
            };
            
            if (from || to) {
                match.timestamp = {};
                if (from) {
                    const fromTimestamp = new Date(from).getTime();
                    match.timestamp.$gte = fromTimestamp;
                    console.log('🔍 [Device Stats] From date converted:', from, '->', fromTimestamp);
                }
                if (to) {
                    const toTimestamp = new Date(to).getTime();
                    match.timestamp.$lte = toTimestamp;
                    console.log('🔍 [Device Stats] To date converted:', to, '->', toTimestamp);
                }
            }
        
            console.log('🔍 [Device Stats] Match query:', JSON.stringify(match, null, 2));
            console.log('🔍 [Device Stats] Collection name:', collectionName);
            console.log('🔍 [Device Stats] Value key:', valueKey);
            
            // First, let's see if we have any documents at all for this device
            const totalCount = await SensorModel.countDocuments({ deviceId: deviceId });
            console.log('🔍 [Device Stats] Total documents for device:', totalCount);
            
            const matchingCount = await SensorModel.countDocuments(match);
            console.log('🔍 [Device Stats] Documents matching query:', matchingCount);
            
            // Let's also see a sample document
            const sampleDoc = await SensorModel.findOne({ deviceId: deviceId }).limit(1);
            console.log('🔍 [Device Stats] Sample document:', JSON.stringify(sampleDoc, null, 2));
            
            // Check if sample document has the required field
            if (sampleDoc) {
                console.log('🔍 [Device Stats] Sample doc fields:', Object.keys(sampleDoc.toObject ? sampleDoc.toObject() : sampleDoc));
                console.log('🔍 [Device Stats] Sample doc has valueKey?', sampleDoc[valueKey] !== undefined);
                console.log('🔍 [Device Stats] Sample doc timestamp type:', typeof sampleDoc.timestamp, sampleDoc.timestamp);
            }
            
            // Also check documents within date range
            if (from && to) {
                const dateRangeCount = await SensorModel.countDocuments({
                    deviceId: deviceId,
                    timestamp: {
                        $gte: new Date(from).getTime(),
                        $lte: new Date(to).getTime()
                    }
                });
                console.log('🔍 [Device Stats] Documents in date range (no value filter):', dateRangeCount);
                
                // Let's also check what the sample document timestamp converts to
                if (sampleDoc && sampleDoc.timestamp) {
                    const sampleDate = new Date(sampleDoc.timestamp);
                    console.log('🔍 [Device Stats] Sample timestamp as date:', sampleDate.toISOString());
                    console.log('🔍 [Device Stats] Expected range:', new Date(from).toISOString(), 'to', new Date(to).toISOString());
                }
            }
            
            const pipeline = [
                { $match: match },
                
                // Convert timestamp to Date if needed (handle string, number, or Date)
                { 
                    $addFields: { 
                        timestamp: { 
                            $switch: {
                                branches: [
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                        then: { $dateFromString: { dateString: "$timestamp" } }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                        then: { $toDate: "$timestamp" }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                        then: { $toDate: "$timestamp" }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                        then: { $toDate: "$timestamp" }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                        then: "$timestamp"
                                    }
                                ],
                                default: new Date()
                            }
                        }
                    }
                },
        
                { $project: { 
                    deviceId: 1, 
                    value: { $ifNull: [ `$${valueKey}`, 0 ] }, 
                    timestamp: 1, 
                    period: { $dateToString: { format, date: "$timestamp" } } 
                } },
                { $sort: { timestamp: 1 } },
                { $group: { 
                    _id: "$period", 
                    first: { $first: "$value" }, 
                    last: { $last: "$value" },
                    count: { $sum: 1 },
                    avg: { $avg: "$value" },
                    min: { $min: "$value" },
                    max: { $max: "$value" }
                } },
                { $project: { 
                    period: "$_id", 
                    consumption: { $subtract: ["$last", "$first"] },
                    count: 1,
                    avg: 1,
                    min: 1,
                    max: 1,
                    first: 1,
                    last: 1
                } },
                { $sort: { _id: 1 } }
            ];
        
            console.log('🔍 [Device Stats] About to run aggregation pipeline...');
            console.log('🔍 [Device Stats] Pipeline:', JSON.stringify(pipeline, null, 2));
            
            const result = await SensorModel.aggregate(pipeline);
            console.log('🔍 [Device Stats] Aggregation results:', JSON.stringify(result, null, 2));
            console.log('🔍 [Device Stats] Results count:', result.length);
            
            // If empty results, let's try a simpler query to debug
            if (result.length === 0) {
                console.log('🔍 [Device Stats] Trying simple match only...');
                const simpleResult = await SensorModel.find(match).limit(5);
                console.log('🔍 [Device Stats] Simple match results:', simpleResult.length, 'documents');
                if (simpleResult.length > 0) {
                    console.log('🔍 [Device Stats] First simple result:', JSON.stringify(simpleResult[0], null, 2));
                }
            }
            
            await siteConnection.close();
        
            const mappedData = result.map(r => ({
                period: r.period,
                totalIndex: r.consumption || 0
            }));
            
            console.log('🔍 [Device Stats] Mapped data:', JSON.stringify(mappedData, null, 2));
        
            res.status(200).json(mappedData);
        } catch (err) {
            console.error(err);
            res.status(500).json({ error: err.message });
        }
    }

    // Handle metrics for a single device (flowRate, pressure, temperature)
    async function handleDeviceMetrics(req, res, collectionName, metricField) {
        try {
            const { siteId, deviceId } = req.params;
            const { granularity = 'day', from, to } = req.query;
            
            console.log('🌊 [Device Metrics] Request params:', { siteId, deviceId, collectionName, metricField });
            console.log('🌊 [Device Metrics] Request query:', { granularity, from, to });
            
            const formatMap = {
                hour: '%Y-%m-%d %H:00:00',
                day: '%Y-%m-%d',
                week: '%Y-%U',
                month: '%Y-%m',
                year: '%Y'
            };
            const format = formatMap[granularity.toLowerCase()] || '%Y-%m-%d';
            const dbName = await getSiteDbName(siteId);
            console.log('🌊 [Device Metrics] Using database:', dbName);
        
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
                dbName,
                serverSelectionTimeoutMS: 30000
            });
        
            const SensorModel = siteConnection.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
            console.log('🌊 [Device Metrics] Using collection:', collectionName, 'for metric:', metricField);
        
            // Match for specific device and ensure the metric field exists
            const match = { 
                [metricField]: { $exists: true, $ne: null }, 
                deviceId: deviceId
            };
            
            if (from || to) {
                match.timestamp = {};
                if (from) {
                    const fromTimestamp = new Date(from).getTime();
                    match.timestamp.$gte = fromTimestamp;
                    console.log('🌊 [Device Metrics] From date converted:', from, '->', fromTimestamp);
                }
                if (to) {
                    const toTimestamp = new Date(to).getTime();
                    match.timestamp.$lte = toTimestamp;
                    console.log('🌊 [Device Metrics] To date converted:', to, '->', toTimestamp);
                }
            }
        
            console.log('🌊 [Device Metrics] Match query:', JSON.stringify(match, null, 2));
            
            // Check if we have any data for this metric
            const metricCount = await SensorModel.countDocuments(match);
            console.log('🌊 [Device Metrics] Documents with', metricField, ':', metricCount);
            
            // Sample document to verify field structure
            const sampleDoc = await SensorModel.findOne({ deviceId: deviceId, [metricField]: { $exists: true } }).limit(1);
            console.log('🌊 [Device Metrics] Sample document with', metricField, ':', JSON.stringify(sampleDoc, null, 2));
        
            const pipeline = [
                { $match: match },
                
                // Convert timestamp to Date if needed
                { 
                    $addFields: { 
                        timestamp: { 
                            $switch: {
                                branches: [
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                        then: { $dateFromString: { dateString: "$timestamp" } }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                        then: { $toDate: "$timestamp" }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                        then: { $toDate: "$timestamp" }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                        then: { $toDate: "$timestamp" }
                                    },
                                    {
                                        case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                        then: "$timestamp"
                                    }
                                ],
                                default: new Date()
                            }
                        }
                    }
                },
        
                // Project the metric field and calculate period
                { $project: { 
                    deviceId: 1, 
                    metricValue: { $ifNull: [ `$${metricField}`, 0 ] }, 
                    timestamp: 1, 
                    period: { $dateToString: { format, date: "$timestamp" } } 
                }},
                { $sort: { timestamp: 1 } },
                
                // Group by period and calculate average for that period
                { $group: { 
                    _id: "$period", 
                    avgValue: { $avg: "$metricValue" },
                    count: { $sum: 1 }
                }},
                { $project: { 
                    period: "$_id", 
                    value: { $round: ["$avgValue", 2] },  // Round to 2 decimal places
                    count: 1,
                    _id: 0
                }},
                { $sort: { period: 1 } }
            ];
        
            console.log('🌊 [Device Metrics] Aggregation pipeline:', JSON.stringify(pipeline, null, 2));
            
            const result = await SensorModel.aggregate(pipeline);
            console.log('🌊 [Device Metrics] Aggregation results:', JSON.stringify(result, null, 2));
            console.log('🌊 [Device Metrics] Results count:', result.length);
            
            await siteConnection.close();
        
            // Map to the expected format
            const mappedData = result.map(r => ({
                period: r.period,
                totalIndex: r.value || 0  // Use totalIndex to match frontend expectations
            }));
            
            console.log('🌊 [Device Metrics] Mapped', metricField, 'data:', JSON.stringify(mappedData, null, 2));
        
            res.status(200).json(mappedData);
        } catch (err) {
            console.error('❌ [Device Metrics] Error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    // Get raw device data from collection named by device type
    async function handleDeviceRawData(req, res) {
        try {
            const { siteId, type, deviceId } = req.params;
            const { from, to, range, limit = 100, sort = 'desc' } = req.query;
            
            console.log('📊 [Device Raw Data] Request params:', { siteId, type, deviceId });
            console.log('📊 [Device Raw Data] Request query:', { from, to, range, limit, sort });
            
            // Verify device exists and matches the type
            const DeviceModel = mainDB.model('Device');
            const device = await DeviceModel.findOne({ 
                deviceId: deviceId,
                siteId: siteId,
                type: type
            }).lean();
            
            if (!device) {
                console.error('❌ [Device Raw Data] Device not found or type mismatch:', { siteId, deviceId, type });
                return res.status(404).json({ error: 'Device not found or type does not match' });
            }
            
            console.log('✅ [Device Raw Data] Device found and verified:', { 
                deviceId: device.deviceId, 
                type: device.type, 
                name: device.name 
            });
            
            // Use device type as collection name (from URL parameter)
            const collectionName = type;
            const dbName = await getSiteDbName(siteId);
            console.log('📊 [Device Raw Data] Using database:', dbName, 'collection:', collectionName);
        
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
                dbName,
                serverSelectionTimeoutMS: 30000
            });
        
            const SensorModel = siteConnection.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
        
            // Build query for specific device
            const query = { deviceId: deviceId };
            
            // Handle time range selection
            let finalFrom = from;
            let finalTo = to;
            
            // If range parameter is provided, calculate from/to dates
            if (range) {
                const now = new Date();
                const endTime = new Date(now);
                endTime.setHours(23, 59, 59, 999); // End of current day
                
                let startTime;
                
                switch (range.toLowerCase()) {
                    case '1h':
                        startTime = new Date(now.getTime() - 1 * 60 * 60 * 1000);
                        break;
                    case '6h':
                        startTime = new Date(now.getTime() - 6 * 60 * 60 * 1000);
                        break;
                    case '12h':
                        startTime = new Date(now.getTime() - 12 * 60 * 60 * 1000);
                        break;
                    case '24h':
                    case '1d':
                        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                        break;
                    case '7d':
                        startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                        break;
                    case '30d':
                        startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                        break;
                    case '90d':
                        startTime = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
                        break;
                    default:
                        console.warn('📊 [Device Raw Data] Unknown range:', range, '- using last 24h');
                        startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
                }
                
                finalFrom = startTime.toISOString();
                finalTo = endTime.toISOString();
                
                console.log('📊 [Device Raw Data] Range applied:', {
                    range,
                    from: finalFrom,
                    to: finalTo,
                    durationHours: (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
                });
            }
            
            // Add time range filtering if provided (either from range calculation or direct params)
            if (finalFrom || finalTo) {
                query.timestamp = {};
                if (finalFrom) {
                    const fromTimestamp = new Date(finalFrom).getTime();
                    query.timestamp.$gte = fromTimestamp;
                    console.log('📊 [Device Raw Data] From date converted:', finalFrom, '->', fromTimestamp);
                }
                if (finalTo) {
                    const toTimestamp = new Date(finalTo).getTime();
                    query.timestamp.$lte = toTimestamp;
                    console.log('📊 [Device Raw Data] To date converted:', finalTo, '->', toTimestamp);
                }
            }
            
            console.log('📊 [Device Raw Data] Query:', JSON.stringify(query, null, 2));
            
            // Count total documents
            const totalCount = await SensorModel.countDocuments(query);
            console.log('📊 [Device Raw Data] Total matching documents:', totalCount);
            
            // Build sort order
            const sortOrder = sort.toLowerCase() === 'asc' ? 1 : -1;
            const sortObj = { timestamp: sortOrder };
            
            // Execute query with limit and sort
            const rawData = await SensorModel
                .find(query)
                .sort(sortObj)
                .limit(parseInt(limit))
                .lean();
            
            console.log('📊 [Device Raw Data] Retrieved documents:', rawData.length);
            
            if (rawData.length > 0) {
                console.log('📊 [Device Raw Data] Sample document:', JSON.stringify(rawData[0], null, 2));
                console.log('📊 [Device Raw Data] Available fields:', Object.keys(rawData[0]));
            }
            
            await siteConnection.close();
            
            // Format response
            const response = {
                device: {
                    deviceId: device.deviceId,
                    name: device.name,
                    type: device.type,
                    siteId: device.siteId
                },
                query: {
                    range: range || null,
                    from: finalFrom || null,
                    to: finalTo || null,
                    originalFrom: from || null,
                    originalTo: to || null,
                    limit: parseInt(limit),
                    sort: sort,
                    totalCount: totalCount
                },
                data: rawData
            };
            
            console.log('📊 [Device Raw Data] Response summary:', {
                deviceId: response.device.deviceId,
                deviceType: response.device.type,
                dataCount: response.data.length,
                totalCount: response.query.totalCount
            });
            
            res.status(200).json(response);
            
        } catch (err) {
            console.error('❌ [Device Raw Data] Error:', err);
            res.status(500).json({ error: err.message });
        }
    }
    
    // Get historical device data for charts (simple raw data without calculations)
    async function handleDeviceHistoricalData(req, res) {
        try {
            const { siteId, deviceId } = req.params;
            const { granularity = 'day', from, to, limit = 100000 } = req.query;
            
            console.log('📈 [Device Historical Data] Request params:', { siteId, deviceId });
            console.log('📈 [Device Historical Data] Request query:', { granularity, from, to, limit });
            
            // Get device info to determine collection name
            const DeviceModel = mainDB.model('Device');
            const device = await DeviceModel.findOne({ 
                deviceId: deviceId,
                siteId: siteId
            }).lean();
            
            if (!device) {
                console.error('❌ [Device Historical Data] Device not found:', { siteId, deviceId });
                return res.status(404).json({ error: 'Device not found' });
            }
            
            console.log('✅ [Device Historical Data] Device found:', { 
                deviceId: device.deviceId, 
                type: device.type, 
                name: device.name 
            });
            
            // Use device type as collection name
            const collectionName = device.type;
            const dbName = await getSiteDbName(siteId);
            console.log('📈 [Device Historical Data] Using database:', dbName, 'collection:', collectionName);
        
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
                dbName,
                serverSelectionTimeoutMS: 30000
            });
        
            const SensorModel = siteConnection.model(collectionName, new mongoose.Schema({}, { strict: false }), collectionName);
        
            // Build query for specific device
            const query = { deviceId: deviceId };
            
            // Add time range filtering if provided
            if (from || to) {
                query.timestamp = {};
                if (from) {
                    const fromTimestamp = new Date(from).getTime();
                    query.timestamp.$gte = fromTimestamp;
                    console.log('📈 [Device Historical Data] From date converted:', from, '->', fromTimestamp);
                }
                if (to) {
                    const toTimestamp = new Date(to).getTime();
                    query.timestamp.$lte = toTimestamp;
                    console.log('📈 [Device Historical Data] To date converted:', to, '->', toTimestamp);
                }
            }
            
            console.log('📈 [Device Historical Data] Query:', JSON.stringify(query, null, 2));
            
            // Count total documents
            const totalCount = await SensorModel.countDocuments(query);
            console.log('📈 [Device Historical Data] Total matching documents:', totalCount);
            
            // Execute query with limit and sort by timestamp ascending
            const historicalData = await SensorModel
                .find(query)
                .sort({ timestamp: 1 })
                .limit(parseInt(limit))
                .lean();
            
            console.log('📈 [Device Historical Data] Retrieved documents:', historicalData.length);
            
            if (historicalData.length > 0) {
                console.log('📈 [Device Historical Data] Sample document:', JSON.stringify(historicalData[0], null, 2));
                console.log('📈 [Device Historical Data] Available fields:', Object.keys(historicalData[0]));
            }
            
            await siteConnection.close();
            
            // Format response for charts
            const chartData = historicalData.map(doc => ({
                timestamp: doc.timestamp,
                value: doc.value || doc.consumption || doc.production || 0,
                unit: doc.unit || getDefaultUnit(device.type),
                // Include additional sensor data if available
                ...(doc.flowRate !== undefined && { flowRate: doc.flowRate }),
                ...(doc.pressure !== undefined && { pressure: doc.pressure }),
                ...(doc.temperature !== undefined && { temperature: doc.temperature }),
                ...(doc.humidity !== undefined && { humidity: doc.humidity }),
                ...(doc.power !== undefined && { power: doc.power })
            }));
            
            // Format response
            const response = {
                device: {
                    deviceId: device.deviceId,
                    name: device.name,
                    type: device.type,
                    siteId: device.siteId
                },
                query: {
                    from: from || null,
                    to: to || null,
                    limit: parseInt(limit),
                    totalCount: totalCount,
                    returnedCount: chartData.length
                },
                data: chartData
            };
            
            console.log('📈 [Device Historical Data] Response summary:', {
                deviceId: response.device.deviceId,
                deviceType: response.device.type,
                dataCount: response.data.length,
                totalCount: response.query.totalCount
            });
            
            res.status(200).json(response);
            
        } catch (err) {
            console.error('❌ [Device Historical Data] Error:', err);
            res.status(500).json({ error: err.message });
        }
    }

    // Helper function to get default unit for device type
    function getDefaultUnit(type) {
        const units = {
            energy: 'kWh',
            solar: 'kWh',
            water: 'm³',
            gas: 'm³',
            temperature: '°C',
            humidity: '%',
            pressure: 'bar'
        };
        return units[type] || 'unit';
    }
    
    
    router.post('/site/:siteId/:type/stats', async (req, res) => {
        const { type } = req.params;
        const field = 'value'; // All device types now use 'value' field
        await handleStats(req, res, type, field);
    });
    
    router.post('/site/:siteId/:type/index', async (req, res) => {
        const { type } = req.params;
        const field = 'value'; // All device types now use 'value' field
        await handleIndex(req, res, type, field);
    });
    
    // Device stats API (GET request)
    router.get('/site/:siteId/:type/device/:deviceId/stats', async (req, res) => {
        const { type } = req.params;
        const { metric } = req.query;
        
        // If metric parameter is provided, fetch that specific metric
        if (metric && ['flowRate', 'pressure', 'temperature'].includes(metric)) {
            await handleDeviceMetrics(req, res, type, metric);
        } else {
            // Default behavior - fetch main consumption value
            const field = 'value'; // All device types now use 'value' field
            await handleDeviceStats(req, res, type, field);
        }
    });

    // Raw device data API - gets raw sensor readings from device type collection
    // GET /api/data/site/{siteId}/{type}/device/{deviceId}/raw
    // Query parameters:
    //   - range: predefined time range ('1h', '6h', '12h', '24h', '1d', '7d', '30d', '90d')
    //   - from: ISO date string (optional) - custom start date filter
    //   - to: ISO date string (optional) - custom end date filter  
    //   - limit: number (default: 100) - max records to return
    //   - sort: 'asc' or 'desc' (default: 'desc') - sort by timestamp
    // Returns: { device: {...}, query: {...}, data: [...] }
    // Priority: range parameter overrides from/to parameters
    router.get('/site/:siteId/:type/device/:deviceId/raw', async (req, res) => {
        await handleDeviceRawData(req, res);
    });
    
    // Get historical device data API - gets raw sensor readings for charts
    // GET /api/data/site/{siteId}/device/{deviceId}/historical
    // Query parameters:
    //   - granularity: 'hour', 'day', 'week', 'month', 'year' (default: 'day')
    //   - from: ISO date string (optional) - custom start date filter
    //   - to: ISO date string (optional) - custom end date filter  
    //   - limit: number (default: 1000) - max records to return
    // Returns: { device: {...}, query: {...}, data: [...] }
    // Priority: from/to parameters override granularity
    router.get('/site/:siteId/device/:deviceId/historical', async (req, res) => {
        await handleDeviceHistoricalData(req, res);
    });
    
    /***************************************************** */
    async function handleGlobalStats(req, res, type, field) {
        try {
        const { siteIds, from, to, granularity = 'day' } = req.body;
    
    
        const dateFormatMap = {
            hour: '%Y-%m-%dT%H',
            day: '%Y-%m-%d',
            week: '%Y-%U',
            month: '%Y-%m',
            year: '%Y'
        };
        const format = dateFormatMap[granularity.toLowerCase()] || '%Y-%m-%d';
    
        const allResults = [];
    
        for (const siteId of siteIds) {
            const site = await Site.findById(siteId).lean();
            if (!site) continue;
    
            const dbName = site.name.replace(/\s+/g, '_'); // sanitize name
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
            dbName,
    
            serverSelectionTimeoutMS: 30000,
            });
    
            const SensorModel = siteConnection.model(type, new mongoose.Schema({}, { strict: false }), type);
    
    
            const match = {
            [field]: { $exists: true },
            deviceId: { $exists: true },
            };
    
            if (from || to) {
            match.timestamp = {};
            if (from) match.timestamp.$gte = new Date(from);
            if (to) match.timestamp.$lte = new Date(to);
            }
    
            const pipeline = [
            { $match: match },
            
            // Convert timestamp to Date if needed (handle string, number, or Date)
            { 
                $addFields: { 
                    timestamp: { 
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                    then: { $dateFromString: { dateString: "$timestamp" } }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                    then: "$timestamp"
                                }
                            ],
                            default: new Date()
                        }
                    }
                }
            },
            
            {
                $project: {
                deviceId: 1,
                value: `$${field}`,
                timestamp: 1,
                period: { $dateToString: { format, date: "$timestamp" } }
                }
            },
            { $sort: { deviceId: 1, timestamp: 1 } },
            {
                $group: {
                _id: { deviceId: "$deviceId", period: "$period" },
                first: { $first: "$value" },
                last: { $last: "$value" }
                }
            },
            {
                $project: {
                period: "$_id.period",
                deviceId: "$_id.deviceId",
                delta: { $subtract: ["$last", "$first"] }
                }
            },
            {
                $group: {
                _id: "$period",
                total: { $sum: "$delta" }
                }
            },
            { $sort: { _id: 1 } }
            ];
    
            const result = await SensorModel.aggregate(pipeline);
    
            allResults.push(...result);
            await siteConnection.close();
        }
    
    
        const merged = allResults.reduce((acc, item) => {
            acc[item._id] = (acc[item._id] || 0) + item.total;
            return acc;
        }, {});
    
        const mergedArray = Object.entries(merged).map(([period, total]) => ({ period, total }));
    
    
        mergedArray.sort((a, b) => new Date(a.period) - new Date(b.period));
    
        res.status(200).json(mergedArray);
        } catch (error) {
        console.error('Error in global stats:', error);
        res.status(500).json({ error: 'Failed to fetch global stats' });
        }
    }
    
    
    
    router.post('/global/:type/stats', async (req, res) => {
        const { type } = req.params;
        const field = 'value'; // All device types now use 'value' field
        await handleGlobalStats(req, res, type, field);
    });
    
    async function handleGlobalIndex(req, res, type, field) {
        try {
        const { siteIds } = req.body;
        let totalIndex = 0;
    
        for (const siteId of siteIds) {
    
            const site = await Site.findById(siteId).lean();
            if (!site) continue;
    
            const dbName = site.name.replace(/\s+/g, '_');
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {
            dbName,
    
            serverSelectionTimeoutMS: 30000,
            });
    
            const SensorModel = siteConnection.model(type, new mongoose.Schema({}, { strict: false }), type);
    
            const pipeline = [
            {
                $match: {
    
                [field]: { $exists: true },
                deviceId: { $exists: true }
    
                }
            },
            
            // Convert timestamp to Date if needed for proper sorting (handle string, number, or Date)
            { 
                $addFields: { 
                    timestamp: { 
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                    then: { $dateFromString: { dateString: "$timestamp" } }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                    then: "$timestamp"
                                }
                            ],
                            default: new Date()
                        }
                    }
                }
            },
            
            { $sort: { deviceId: 1, timestamp: -1 } },
            {
                $group: {
                _id: "$deviceId",
    
                lastReading: { $first: `$${field}` }
    
                }
            },
            {
                $group: {
                _id: null,
    
                totalIndex: { $sum: "$lastReading" }
    
                }
            }
            ];
    
            const result = await SensorModel.aggregate(pipeline);
    
            if (result.length > 0) {
            totalIndex += result[0].totalIndex;
            }
            await siteConnection.close();
        }
    
        res.status(200).json({ totalIndex });
        } catch (error) {
        console.error('Error in global index:', error);
        res.status(500).json({ error: 'Failed to fetch global index' });
        }
    }
    
    
    router.post('/global/:type/index', async (req, res) => {
        const { type } = req.params;
        const field = 'value'; // All device types now use 'value' field
        await handleGlobalIndex(req, res, type, field);
    });
    
    async function handleGlobalCompare(req, res, type, field) {
        try {
        const { siteIds, from, to, granularity = 'day' } = req.body;
    
        const dateFormatMap = {
            hour: '%Y-%m-%dT%H',
            day: '%Y-%m-%d',
            week: '%Y-%U',
            month: '%Y-%m',
            year: '%Y'
        };
        const format = dateFormatMap[granularity.toLowerCase()] || '%Y-%m-%d';
    
        const siteResults = [];
    
        await Promise.all(siteIds.map(async (siteId) => {
            const site = await Site.findById(siteId).lean();
            if (!site) return;
    
            const dbName = site.name.replace(/\s+/g, '_');
            const siteConnection = mongoose.createConnection(process.env.MONGO_URI, {     
            dbName,
            serverSelectionTimeoutMS: 30000,
            });
    
            const SensorModel = siteConnection.model(type, new mongoose.Schema({}, { strict: false }), type);
    
            const match = {
            [field]: { $exists: true },
            deviceId: { $exists: true }
            };
            if (from || to) {
            match.timestamp = {};
            if (from) match.timestamp.$gte = new Date(from);
            if (to) match.timestamp.$lte = new Date(to);
            }
    
    
    
            const sampleDocs = await SensorModel.find(match).limit(5);
    
    
            const pipeline = [
            { $match: match },
            
            // Convert timestamp to Date if needed (handle string, number, or Date)
            { 
                $addFields: { 
                    timestamp: { 
                        $switch: {
                            branches: [
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                    then: { $dateFromString: { dateString: "$timestamp" } }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                    then: { $toDate: "$timestamp" }
                                },
                                {
                                    case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                    then: "$timestamp"
                                }
                            ],
                            default: new Date()
                        }
                    }
                }
            },
            
            {
                $project: {
                deviceId: 1,
                value: { $ifNull: [ `$${field}`, 0 ] },
                timestamp: 1,
                period: { $dateToString: { format, date: "$timestamp" } }
                }
            },
            { $sort: { deviceId: 1, timestamp: 1 } },
            {
                $group: {
                _id: { deviceId: "$deviceId", period: "$period" },
                first: { $first: "$value" },
                last: { $last: "$value" }
                }
            },
            {
                $project: {
                period: "$_id.period",
                deviceId: "$_id.deviceId",
                delta: { $subtract: ["$last", "$first"] }
                }
            },
            {
                $group: {
                _id: "$period",
                total: { $sum: "$delta" }
                }
            },
            { $sort: { _id: 1 } }
            ];
    
            const result = await SensorModel.aggregate(pipeline);
            siteResults.push({
            siteId,
            siteName: site.name,
            values: result.map(item => ({
                period: item._id,
                value: item.total
            }))
            });
    
            await siteConnection.close();
        }));
    
        
    
        res.status(200).json(siteResults);
        } catch (error) {
        console.error('Error in global comparison:', error);
        res.status(500).json({
            error: 'Failed to fetch comparison data',
            details: error.message
    
        });
        }
    }
    
    
    router.post('/global/:type/compare', async (req, res) => {
        const { type } = req.params;
        const field = 'value'; // All device types now use 'value' field
        await handleGlobalCompare(req, res, type, field);
    });
    

    // Add endpoint to get devices by type for a site
    router.get('/site/:siteId/devices', async (req, res) => {
        try {
        const { siteId } = req.params;  
        const { type } = req.query;
        
        // Use the imported Device model
        const DeviceModel = mainDB.model('Device');
        
        let query = { siteId: siteId };
        if (type) {
            query.type = type;
        }
        
        const devices = await DeviceModel.find(query).lean();
        res.json(devices);
        } catch (err) {
        res.status(500).json({ error: err.message });
        }
    });
    
    router.post('/site/:siteId/:type/compare', async (req, res) => {
        const { siteId, type } = req.params;
        const { from, to, granularity = 'day', deviceIds } = req.body;
        const field = 'value'; // All device types now use 'value' field
        const dbName = await getSiteDbName(siteId);
        const siteConnection = mongoose.createConnection(process.env.MONGO_URI, { dbName });
    
        const match = {
        [field]: { $exists: true },
        deviceId: { $exists: true }
        };
        if (from || to) {
        match.timestamp = {};
        if (from) match.timestamp.$gte = new Date(from);
        if (to) match.timestamp.$lte = new Date(to);
        }
        if (deviceIds && deviceIds.length) {
        match.deviceId = { $in: deviceIds };
        }
    
        const formatMap = { hour: '%Y-%m-%d %H:00:00', day: '%Y-%m-%d', month: '%Y-%m', year: '%Y' };
        const format = formatMap[granularity] || '%Y-%m-%d';
    
        const pipeline = [
        { $match: match },
        
        // Convert timestamp to Date if needed (handle string, number, or Date)
        { 
            $addFields: { 
                timestamp: { 
                    $switch: {
                        branches: [
                            {
                                case: { $eq: [{ $type: "$timestamp" }, "string"] },
                                then: { $dateFromString: { dateString: "$timestamp" } }
                            },
                            {
                                case: { $eq: [{ $type: "$timestamp" }, "double"] },
                                then: { $toDate: "$timestamp" }
                            },
                            {
                                case: { $eq: [{ $type: "$timestamp" }, "long"] },
                                then: { $toDate: "$timestamp" }
                            },
                            {
                                case: { $eq: [{ $type: "$timestamp" }, "int"] },
                                then: { $toDate: "$timestamp" }
                            },
                            {
                                case: { $eq: [{ $type: "$timestamp" }, "date"] },
                                then: "$timestamp"
                            }
                        ],
                        default: new Date()
                    }
                }
            }
        },
        
        { $project: { deviceId: 1, value: `$${field}`, timestamp: 1, period: { $dateToString: { format, date: '$timestamp' } } } },
        { $sort: { deviceId: 1, timestamp: 1 } },
        { $group: { _id: { deviceId: '$deviceId', period: '$period' }, first: { $first: '$value' }, last: { $last: '$value' } } },
        { $project: { period: '$_id.period', deviceId: '$_id.deviceId', delta: { $subtract: ['$last', '$first'] } } },
        { $group: { _id: '$deviceId', values: { $push: { period: '$period', value: '$delta' } } } }
        ];
    
        const SensorModel = siteConnection.model(type, new mongoose.Schema({}, { strict: false }), type);
        const result = await SensorModel.aggregate(pipeline);
        await siteConnection.close();
    
        // Fetch devices to get device names from Device collection
        const DeviceModel = mainDB.model('Device');
        const devices = await DeviceModel.find({ siteId }).lean();
        const deviceNameMap = {};
        devices.forEach(device => {
            deviceNameMap[device.deviceId] = device.name || device.deviceId;
        });
    
        res.json(result.map(r => ({
        deviceId: r._id,
        deviceName: deviceNameMap[r._id] || r._id,
        values: r.values
        })));
    });

export default router; 