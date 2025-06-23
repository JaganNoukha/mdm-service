import * as dotenv from 'dotenv';
dotenv.config();

export const databaseConfig = {
  mongoUri: process.env.MONGO_URI,
  mysql: {
    host: process.env.MYSQL_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_PORT, 10) || 3306,
    username: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || 'password',
    database: process.env.MYSQL_DB || 'nestapp',
  },
};
