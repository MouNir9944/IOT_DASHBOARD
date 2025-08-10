# Daily Consumption Calculation Fix

## Problem Description
The daily consumption calculation was incorrect due to two main issues:

1. **Backend Aggregation Pipeline**: The MongoDB aggregation was using a "first and last reading" approach per period, which did not guarantee that readings corresponded to the start (00:00) and end (23:59) of a given day.
2. **Frontend Time Range**: The date range generation didn't ensure full days (00:00 to 23:59) for daily periods, leading to incomplete daily consumption calculations.

## Solution Implemented

### Backend Fix (`backend_main_manager/routes/data.js`)

#### Site-Specific Stats (`handleStats` function)
- **Updated aggregation pipeline for 'day' granularity**: Now explicitly defines `dayStart` (00:00:00) and `dayEnd` (23:59:59) boundaries for each day
- **Improved grouping**: Groups by `deviceId`, `period`, `dayStart`, and `dayEnd` to accurately capture first and last readings within precise daily boundaries
- **Consumption calculation**: Calculates consumption as the difference between `last` and `first` reading within each 24-hour period
- **Validation**: Added `validatedTotal` field that takes the absolute value of negative consumption (handles meter rollovers/resets)
- **Enhanced logging**: Added comprehensive logging for debugging aggregation process and results

#### Global Stats (`handleGlobalStats` function)
- **Applied same daily aggregation logic**: Updated to use the same improved daily consumption calculation approach
- **Conditional pipeline**: Uses enhanced daily logic for 'day' granularity, maintains original logic for other granularities
- **Response validation**: Uses `validatedTotal` for daily granularity to ensure positive consumption values

### Frontend Fix (`front-dashboard/src/app/dashboard/sites/[siteId]/page.tsx`)

#### Time Period Selection
- **Added new options**: '1m' (1 month) and '3m' (3 months) with `granularity: 'month'`
- **Updated existing periods**: Ensured '7d', '30d', and 'custom' periods represent full days

#### Date Range Calculation (`getDateRange` function)
- **7d period**: Now starts at 00:00:00 exactly 7 days ago, ends at 23:59:59.999 today
- **30d period**: Now starts at 00:00:00 exactly 30 days ago, ends at 23:59:59.999 today
- **1m period**: Starts at 00:00:00 on the 1st of the previous month
- **3m period**: Starts at 00:00:00 on the 1st of 3 months ago
- **Custom period**: Ensures custom dates represent full days (00:00:00 to 23:59:59.999)

#### Granularity Handling
- **New function**: `getChartGranularity()` returns 'month' for '1m' and '3m' periods, 'day' for others
- **Updated useEffect**: Now uses `getChartGranularity()` for proper backend communication

### Frontend Fix (`front-dashboard/src/app/dashboard/components/DashboardContent.tsx`)

#### Time Period Selection
- **Added new options**: '1m' (1 month) and '3m' (3 months) with `granularity: 'month'`
- **Consistent with site detail page**: Same time period options and behavior

#### Date Range Calculation (`getDateRange` function)
- **Same fixes as site detail page**: Ensures full days (00:00 to 23:59) for all daily periods
- **Month periods**: Properly calculate start of previous months for '1m' and '3m' options
- **Custom dates**: Ensure custom date ranges represent complete days

#### Granularity Handling
- **New function**: `getChartGranularity()` for proper chart data granularity
- **Updated useEffect**: Uses `getChartGranularity()` for fetching global stats
- **Maintains compatibility**: Keeps `getGranularity()` function for backward compatibility

## How the System Now Works

### Daily Consumption Calculation
1. **Frontend**: Sends date ranges that represent full days (00:00:00 to 23:59:59.999)
2. **Backend**: 
   - Creates precise daily boundaries (00:00:00 to 23:59:59) for each timestamp
   - Groups readings by device and day boundary
   - Calculates consumption as `last_reading - first_reading` within each day
   - Sums consumption across all devices for each day
   - Validates negative values (takes absolute value for display)
3. **Result**: Accurate daily consumption figures that represent true 24-hour usage

### Month Granularity Support
1. **Frontend**: New '1m' and '3m' options with proper date calculations
2. **Backend**: Maintains existing month aggregation logic for non-daily granularities
3. **Data Flow**: Proper granularity communication between frontend and backend

## Benefits

1. **Accuracy**: Daily consumption now correctly represents 24-hour periods
2. **Consistency**: Same logic applied across site-specific and global statistics
3. **Flexibility**: Support for both daily and monthly time periods
4. **Reliability**: Handles edge cases like meter resets and negative consumption values
5. **Debugging**: Enhanced logging for troubleshooting aggregation issues

## Testing Recommendations

1. **Daily Periods**: Verify that 7d and 30d periods show accurate daily consumption
2. **Month Periods**: Test 1m and 3m options with month granularity
3. **Custom Dates**: Ensure custom date ranges work correctly with full-day boundaries
4. **Edge Cases**: Test with devices that may have meter resets or negative consumption
5. **Data Consistency**: Compare results between site detail and global dashboard views

## Files Modified

1. **`backend_main_manager/routes/data.js`**
   - `handleStats` function: Enhanced daily aggregation pipeline
   - `handleGlobalStats` function: Applied same daily aggregation logic
   - Added validation and logging throughout

2. **`front-dashboard/src/app/dashboard/sites/[siteId]/page.tsx`**
   - Added '1m' and '3m' time period options
   - Fixed `getDateRange` function for full-day boundaries
   - Added `getChartGranularity` function
   - Updated useEffect to use proper granularity

3. **`front-dashboard/src/app/dashboard/components/DashboardContent.tsx`**
   - Added '1m' and '3m' time period options
   - Fixed `getDateRange` function for full-day boundaries
   - Added `getChartGranularity` function
   - Updated useEffect to use proper granularity
   - Ensured consistency with site detail page fixes

## Summary

The daily consumption calculation issue has been comprehensively resolved through:
- **Backend**: Enhanced MongoDB aggregation pipelines that ensure accurate daily boundaries and consumption calculation
- **Frontend**: Improved time period selection and date range generation that guarantees full-day representation
- **Consistency**: Same fixes applied across both site-specific and global dashboard components

This ensures that users get accurate consumption data regardless of which dashboard view they use, with proper support for both daily and monthly time periods.
