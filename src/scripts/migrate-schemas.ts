import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateSchemas() {
  const client = new MongoClient(process.env.MONGODB_URI);
  
  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db();
    
    // Check if master_schemas collection exists
    const collections = await db.listCollections().toArray();
    const masterSchemasExists = collections.some(c => c.name === 'master_schemas');
    
    if (!masterSchemasExists) {
      console.log('No master_schemas collection found. Nothing to migrate.');
      return;
    }

    // Get all schemas from master_schemas
    const schemas = await db.collection('master_schemas').find({}).toArray();
    console.log(`Found ${schemas.length} schemas to migrate`);

    if (schemas.length === 0) {
      console.log('No schemas to migrate');
      return;
    }

    // Insert schemas into the schemas collection
    await db.collection('schemas').insertMany(schemas);
    console.log('Successfully migrated schemas to schemas collection');

    // Drop the master_schemas collection
    await db.collection('master_schemas').drop();
    console.log('Dropped master_schemas collection');

  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await client.close();
    console.log('Disconnected from MongoDB');
  }
}

migrateSchemas().catch(console.error); 