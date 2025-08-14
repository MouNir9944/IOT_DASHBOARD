// Frontend Configuration
// Change the port number here to run on a different port
const config = {
  port: process.env.PORT || 3001,
  apiUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000'
};

module.exports = config;
