import { Injectable, Logger, BadRequestException, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Schema, Model } from 'mongoose';
import { CreateSchemaDto } from './dto/create-schema.dto';
import { FieldType, RelationshipType } from 'src/common/enums/mdm.enum';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { nanoidGenerator } from 'src/utility/nanoid.util';

interface FindAllOptions {
    page?: number;
    limit?: number;
    sort?: string;
    order?: 'asc' | 'desc';
    search?: string;
    filters?: Record<string, any>;
  }

@Injectable()
export class SchemaService {

  private readonly logger = new Logger(SchemaService.name);
  private readonly schemaCollection = 'schemas';
  private schemaCache: Map<string, { schema: CreateSchemaDto; model: any }> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private eventEmitter: EventEmitter2
  ) {
    this.logger.log('SchemaService initialized');
    this.logger.log(`MongoDB Connection State: ${this.connection.readyState}`);
    this.initializeSchemaCollection();
  }

  private async initializeSchemaCollection() {
    try {
      // Create schema collection if it doesn't exist
      const collections = await this.connection.db.listCollections().toArray();
      const schemaCollectionExists = collections.some(c => c.name === this.schemaCollection);
      
      if (!schemaCollectionExists) {
        await this.connection.db.createCollection(this.schemaCollection);
        this.logger.log(`Created schema collection: ${this.schemaCollection}`);
      }

      // Load all stored schemas
      await this.loadStoredSchemas();
    } catch (error) {
      this.logger.error('Error initializing schema collection:', error);
    }
  }

  private async loadStoredSchemas() {
    try {
      const schemas = await this.connection.db
        .collection(this.schemaCollection)
        .find({})
        .toArray();

      this.logger.log(`Loading ${schemas.length} stored schemas`);
      this.logger.log(`Available schemas: ${JSON.stringify(schemas.map(s => s.schema.name))}`);

      for (const schemaDoc of schemas) {
        const createSchemaDto = schemaDoc.schema;
        const schemaName = createSchemaDto.name.toLowerCase();
        
        this.logger.log(`Loading schema: ${schemaName}`);
        
        const schemaDefinition = this.buildSchemaDefinition(createSchemaDto);
        const schema = new Schema(schemaDefinition);
        const Model = this.connection.model(schemaName, schema, schemaName);
        
        // Store in cache
        this.schemaCache.set(schemaName, {
          schema: createSchemaDto,
          model: Model
        });
        
        this.logger.log(`Created model for schema: ${schemaName}`);
      }
    } catch (error) {
      this.logger.error('Error loading stored schemas:', error);
    }
  }

  private getModel(schemaName: string) {
    const schemaNameLower = schemaName.toLowerCase();
    const cached = this.schemaCache.get(schemaNameLower);
    
    if (!cached) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }
    
    return cached.model;
  }

  private async validateGroupId(groupId: string) {
    if (!groupId) return;

    // Get the groups collection
    const groupsCollection = this.connection.db.collection('groups');
    
    // Check if the group ID exists
    const group = await groupsCollection.findOne({ groupId });
    
    if (!group) {
      throw new BadRequestException(
        `Invalid group ID: ${groupId}. This group ID does not exist in the groups collection.`
      );
    }
  }

  async createSchema(createSchemaDto: CreateSchemaDto) {
    const schemaName = createSchemaDto.name.toLowerCase();
    
    // Check if schema already exists
    const existingSchema = await this.connection.db
      .collection(this.schemaCollection)
      .findOne({ 'schema.name': schemaName });

    if (existingSchema) {
      throw new BadRequestException(`Schema ${schemaName} already exists`);
    }

    // Transform master field names
    const transformedSchema = {
      ...createSchemaDto,
      fields: createSchemaDto.fields.map(field => {
        if (field.type === FieldType.MASTER) {
          return {
            ...field,
            name: `${field.masterType.toLowerCase()}Id`
          };
        }
        return field;
      })
    };

    // Validate schema
    await this.validateSchema(transformedSchema);

    // Validate group ID if provided
    if (transformedSchema.groupId) {
      await this.validateGroupId(transformedSchema.groupId);
    }

    // Store schema
    await this.connection.db
      .collection(this.schemaCollection)
      .insertOne({ schema: transformedSchema });

    // Create and cache the model
    const schemaDefinition = this.buildSchemaDefinition(transformedSchema);
    const schema = new Schema(schemaDefinition);
    const Model = this.connection.model(schemaName, schema, schemaName);
    
    // Update cache
    this.schemaCache.set(schemaName, {
      schema: transformedSchema,
      model: Model
    });

    // Emit schema created event
    this.eventEmitter.emit('schema.created', { schemaName, schema: transformedSchema });

    return { message: `Schema ${schemaName} created successfully` };
  }

  private async validateSchema(createSchemaDto: CreateSchemaDto) {
    // Validate field names are unique
    const fieldNames = createSchemaDto.fields.map(f => f.name);
    const uniqueFieldNames = new Set(fieldNames);
    if (fieldNames.length !== uniqueFieldNames.size) {
      throw new BadRequestException('Field names must be unique');
    }

    // Validate master relationships
    for (const field of createSchemaDto.fields) {
      if (field.type === FieldType.MASTER) {
        if (!field.masterType) {
          throw new BadRequestException(
            `Field ${field.name} is of type MASTER but masterType is not specified`
          );
        }

        if (!field.relationshipType) {
          throw new BadRequestException(
            `Field ${field.name} is of type MASTER but relationshipType is not specified`
          );
        }

        // Check if referenced master exists
        const masterSchema = await this.connection.db
          .collection(this.schemaCollection)
          .findOne({ 'schema.name': field.masterType.toLowerCase() });

        if (!masterSchema) {
          throw new BadRequestException(
            `Referenced master ${field.masterType} does not exist`
          );
        }
      }
    }
  }

  private buildSchemaDefinition(createSchemaDto: CreateSchemaDto) {
    const schemaDefinition = {};
    
    // Add the unique ID field automatically
    const idFieldName = `${createSchemaDto.name.toLowerCase()}Id`;
    schemaDefinition[idFieldName] = {
      type: String,
      required: true,
      unique: true,
      default: () => nanoidGenerator.generate()
    };
    
    // Add standard fields
    schemaDefinition['createdAt'] = {
      type: Date,
      default: Date.now
    };

    schemaDefinition['updatedAt'] = {
      type: Date,
      default: Date.now
    };

    schemaDefinition['isActive'] = {
      type: Boolean,
      default: true
    };

    schemaDefinition['isDeleted'] = {
      type: Boolean,
      default: false
    };
    
    // Add the rest of the fields
    createSchemaDto.fields.forEach(field => {
      if (field.type === FieldType.MASTER) {
        // For master relationships, create appropriate reference field based on relationship type
        const fieldName = `${field.masterType.toLowerCase()}Id`;
        switch (field.relationshipType) {
          case RelationshipType.ONE_TO_ONE:
          case RelationshipType.MANY_TO_ONE:
            schemaDefinition[fieldName] = {
              type: String,
              required: field.required || false,
              ref: field.masterType.toLowerCase()
            };
            break;
            
          case RelationshipType.ONE_TO_MANY:
          case RelationshipType.MANY_TO_MANY:
            schemaDefinition[fieldName] = [{
              type: String,
              ref: field.masterType.toLowerCase()
            }];
            break;
            
          default:
            throw new BadRequestException(
              `Invalid relationship type ${field.relationshipType} for field ${field.name}`
            );
        }
      } else {
        schemaDefinition[field.name] = this.getMongooseType(field.type);
        
        if (field.required) {
          schemaDefinition[field.name].required = true;
        }
        
        if (field.unique) {
          schemaDefinition[field.name].unique = true;
        }
        
        if (field.defaultValue !== undefined) {
          schemaDefinition[field.name].default = field.defaultValue;
        }
      }
    });

    return schemaDefinition;
  }

  private getMongooseType(type: string) {
    switch (type) {
      case 'string':
        return { type: String };
      case 'number':
        return { type: Number };
      case 'boolean':
        return { type: Boolean };
      case 'date':
        return { type: Date };
      case 'object':
        return { type: Object };
      case 'array':
        return { type: Array };
      default:
        return { type: String };
    }
  }

  private async validateMasterReferences(schemaName: string, data: any, isUpdate: boolean = false) {
    const schemaDoc = await this.connection.db
      .collection(this.schemaCollection)
      .findOne({ 'schema.name': schemaName.toLowerCase() });

    if (!schemaDoc) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }

    const schema = schemaDoc.schema;
    const validationPromises = [];

    for (const field of schema.fields) {
      // Skip validation if this is an update and the field is not being updated
      if (isUpdate && !(field.name in data)) {
        continue;
      }

      if (field.type === FieldType.MASTER) {
        const masterType = field.masterType.toLowerCase();
        const masterId = data[field.name];

        if (field.required && !masterId) {
          throw new BadRequestException(`Field ${field.name} is required`);
        }

        if (masterId) {
          // For array of references (ONE_TO_MANY, MANY_TO_MANY)
          if (Array.isArray(masterId)) {
            validationPromises.push(
              Promise.all(
                masterId.map(async (id) => {
                  const exists = await this.connection.models[masterType].exists({ [`${masterType}Id`]: id });
                  if (!exists) {
                    throw new BadRequestException(
                      `Invalid reference: ${id} does not exist in ${masterType}`
                    );
                  }
                })
              )
            );
          } 
          // For single reference (ONE_TO_ONE, MANY_TO_ONE)
          else {
            validationPromises.push(
              (async () => {
                const exists = await this.connection.models[masterType].exists({ [`${masterType}Id`]: masterId });
                if (!exists) {
                  throw new BadRequestException(
                    `Invalid reference: ${masterId} does not exist in ${masterType}`
                  );
                }
              })()
            );
          }
        }
      }
    }

    await Promise.all(validationPromises);
  }

  private async getLatestSchema(schemaName: string) {
    const schemaNameLower = schemaName.toLowerCase();
    
    // Get latest schema from MongoDB
    const schemaDoc = await this.connection.db
      .collection(this.schemaCollection)
      .findOne({ 'schema.name': schemaNameLower });

    if (!schemaDoc) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }

    // Build new schema definition
    const schemaDefinition = this.buildSchemaDefinition(schemaDoc.schema);
    const schema = new Schema(schemaDefinition);

    // Update the model with new schema
    if (this.connection.models[schemaNameLower]) {
      (this.connection.models as any)[schemaNameLower] = undefined;
    }
    const Model = this.connection.model(schemaNameLower, schema, schemaNameLower);
    
    return Model;
  }

  async createData(schemaName: string, data: any) {
    this.logger.log(`Creating data for schema: ${schemaName}`);
    this.logger.log(`Data: ${JSON.stringify(data)}`);
    
    const Model = this.getModel(schemaName);
    
    // Get the schema definition
    const schema = Model.schema;
    
    // Remove any attempt to set the auto-generated ID
    const idFieldName = `${schemaName.toLowerCase()}Id`;
    delete data[idFieldName];
    
    // Get schema definition from cache
    const schemaDef = this.schemaCache.get(schemaName.toLowerCase())?.schema;
    if (!schemaDef) {
      throw new NotFoundException(`Schema ${schemaName} not found in cache`);
    }

    // Validate and convert field types
    const convertedData = {};
    for (const field of schemaDef.fields) {
      const value = data[field.name];
      
      // Skip if field is not provided and not required
      if (value === undefined && !field.required) {
        continue;
      }

      // Validate required fields
      if (field.required && value === undefined) {
        throw new BadRequestException(`Field ${field.name} is required`);
      }

      // Skip type validation for MASTER type fields as they are handled by validateMasterReferences
      if (field.type === FieldType.MASTER) {
        convertedData[field.name] = value;
        continue;
      }

      // Type conversion and validation
      try {
        switch (field.type) {
          case FieldType.NUMBER:
            if (value !== undefined) {
              const num = Number(value);
              if (isNaN(num)) {
                throw new BadRequestException(`Field ${field.name} must be a valid number`);
              }
              convertedData[field.name] = num;
            }
            break;

          case FieldType.BOOLEAN:
            if (value !== undefined) {
              if (typeof value === 'string') {
                convertedData[field.name] = value.toLowerCase() === 'true';
              } else {
                convertedData[field.name] = Boolean(value);
              }
            }
            break;

          case FieldType.DATE:
            if (value !== undefined) {
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                throw new BadRequestException(`Field ${field.name} must be a valid date`);
              }
              convertedData[field.name] = date;
            }
            break;

          case FieldType.ARRAY:
            if (value !== undefined && !Array.isArray(value)) {
              throw new BadRequestException(`Field ${field.name} must be an array`);
            }
            convertedData[field.name] = value;
            break;

          case FieldType.OBJECT:
            if (value !== undefined && typeof value !== 'object') {
              throw new BadRequestException(`Field ${field.name} must be an object`);
            }
            convertedData[field.name] = value;
            break;

          default:
            convertedData[field.name] = value;
        }
      } catch (error) {
        if (error instanceof BadRequestException) {
          throw error;
        }
        throw new BadRequestException(`Invalid value for field ${field.name}: ${error.message}`);
      }
    }

    // Validate master references
    await this.validateMasterReferences(schemaName, convertedData);
    
    // Create and save the instance
    const instance = new Model(convertedData);
    const savedInstance = await instance.save();
    this.logger.log(`Data created successfully: ${JSON.stringify(savedInstance)}`);
    
    return savedInstance;
  }

  async findAll(schemaName: string, options: FindAllOptions = {}) {
    const Model = this.getModel(schemaName);

    const {
      page = 1,
      limit = 10,
      sort = 'createdAt',
      order = 'desc',
      search,
      filters
    } = options;

    const query: any = {};

    // Add search condition if provided
    if (search) {
      const searchFields = Object.keys(Model.schema.paths).filter(
        path => Model.schema.paths[path].instance === 'String'
      );
      query.$or = searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
    }

    // Add filters if provided
    if (filters) {
      Object.assign(query, filters);
    }

    // Calculate pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and sorting
    const [data, total] = await Promise.all([
      Model.find(query)
        .sort({ [sort]: order === 'desc' ? -1 : 1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      Model.countDocuments(query)
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  async findOne(schemaName: string, id: string) {
    const Model = this.getModel(schemaName);
    
    // Use the correct ID field for the schema (e.g., cityId for city schema)
    const idFieldName = `${schemaName.toLowerCase()}Id`;
    const data = await Model.findOne({ [idFieldName]: id }).exec();
    
    if (!data) {
      throw new NotFoundException(`Record not found in ${schemaName}`);
    }
    
    return data;
  }

  async update(schemaName: string, id: string, data: any) {
    const Model = this.getModel(schemaName);
    
    // Get the correct ID field name
    const idFieldName = `${schemaName.toLowerCase()}Id`;
    
    // First find the existing document to check if it exists
    const existingDoc = await Model.findOne({ [idFieldName]: id }).exec();
    if (!existingDoc) {
      throw new NotFoundException(`Record not found in ${schemaName}`);
    }

    // Remove any attempt to update the auto-generated ID
    delete data[idFieldName];
    
    // Validate only the fields being updated
    await this.validateMasterReferences(schemaName, data, true);
    
    // Update only the provided fields
    const updated = await Model.findOneAndUpdate(
      { [idFieldName]: id },
      { $set: data },
      { new: true }
    ).exec();
    
    return updated;
  }

  async remove(schemaName: string, id: string) {
    const Model = this.getModel(schemaName);
    
    // Use the correct ID field for the schema
    const idFieldName = `${schemaName.toLowerCase()}Id`;
    const deleted = await Model.findOneAndDelete({ [idFieldName]: id }).exec();
    
    if (!deleted) {
      throw new NotFoundException(`Record not found in ${schemaName}`);
    }
    
    return { message: 'Record deleted successfully' };
  }

  async updateSchema(schemaName: string, updateSchemaDto: CreateSchemaDto) {
    const schemaNameLower = schemaName.toLowerCase();
    
    // Check if schema exists
    const existingSchema = await this.connection.db
      .collection(this.schemaCollection)
      .findOne({ 'schema.name': schemaNameLower });

    if (!existingSchema) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }

    // Transform master field names
    const transformedSchema = {
      ...updateSchemaDto,
      fields: updateSchemaDto.fields.map(field => {
        if (field.type === FieldType.MASTER) {
          return {
            ...field,
            name: `${field.masterType.toLowerCase()}Id`
          };
        }
        return field;
      })
    };

    // Validate schema
    await this.validateSchema(transformedSchema);

    // Validate group ID if provided
    if (transformedSchema.groupId) {
      await this.validateGroupId(transformedSchema.groupId);
    }

    // Update schema
    await this.connection.db
      .collection(this.schemaCollection)
      .updateOne(
        { 'schema.name': schemaNameLower },
        { $set: { schema: transformedSchema } }
      );

    // Update model in cache
    const schemaDefinition = this.buildSchemaDefinition(transformedSchema);
    const schema = new Schema(schemaDefinition);
    const Model = this.connection.model(schemaNameLower, schema, schemaNameLower);
    
    this.schemaCache.set(schemaNameLower, {
      schema: transformedSchema,
      model: Model
    });

    // Emit schema updated event
    this.eventEmitter.emit('schema.updated', { schemaName: schemaNameLower, schema: transformedSchema });

    return { message: `Schema ${schemaName} updated successfully` };
  }

  async getSchema(schemaName: string) {
    this.logger.log(`Attempting to get schema: ${schemaName}`);
    
    const schema = await this.connection.db
      .collection(this.schemaCollection)
      .findOne({ 'schema.name': schemaName.toLowerCase() });

    this.logger.log(`Found schema: ${JSON.stringify(schema)}`);

    if (!schema) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }

    return schema.schema;
  }

  async getAllSchemas() {
    this.logger.log('Fetching all schemas...');
    
    const schemas = await this.connection.db
      .collection(this.schemaCollection)
      .find({})
      .toArray();

    this.logger.log(`Found ${schemas.length} schemas`);

    // Get all unique groupIds from schemas
    const groupIds = [...new Set(schemas.map(s => s.schema.groupId).filter(Boolean))];

    // Fetch all groups in one query
    const groups = groupIds.length > 0 
      ? await this.connection.db
          .collection('groups')
          .find({ groupId: { $in: groupIds } })
          .toArray()
      : [];

    // Create a map of groupId to groupName for quick lookup
    const groupMap = new Map(groups.map(g => [g.groupId, g.groupName]));

    // Map schemas and include groupName
    const schemasWithGroup = schemas.map(schema => ({
      ...schema.schema,
      groupName: schema.schema.groupId ? groupMap.get(schema.schema.groupId) : null
    }));

    return schemasWithGroup;
  }

  async deleteSchema(schemaName: string, force: boolean = false) {
    const schemaNameLower = schemaName.toLowerCase();
    
    // Check if schema exists
    const schema = await this.connection.db
      .collection(this.schemaCollection)
      .findOne({ 'schema.name': schemaNameLower });

    if (!schema) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }

    // Check if schema is referenced by other schemas
    const referencingSchemas = await this.connection.db
      .collection(this.schemaCollection)
      .find({
        'schema.fields': {
          $elemMatch: {
            type: 'master',
            masterType: schemaNameLower
          }
        }
      })
      .toArray();

    if (referencingSchemas.length > 0 && !force) {
      const referencingSchemaNames = referencingSchemas.map(s => s.schema.name).join(', ');
      throw new BadRequestException(
        `Cannot delete schema ${schemaName} because it is referenced by other schemas: ${referencingSchemaNames}. ` +
        'Use force=true to delete anyway.'
      );
    }

    try {
      // Delete the schema from the database
      await this.connection.db
        .collection(this.schemaCollection)
        .deleteOne({ 'schema.name': schemaNameLower });

      // Delete the model from Mongoose
      if (this.connection.models[schemaNameLower]) {
        this.connection.deleteModel(schemaNameLower);
      }

      // Remove from cache
      this.schemaCache.delete(schemaNameLower);

      // If force=true, also delete all data in the collection
      if (force) {
        await this.connection.db
          .collection(schemaNameLower)
          .drop()
          .catch(error => {
            this.logger.warn(`Error dropping collection ${schemaNameLower}: ${error.message}`);
          });
      }

      // Emit schema deleted event
      this.eventEmitter.emit('schema.deleted', { schemaName: schemaNameLower });

      return { message: `Schema ${schemaName} deleted successfully` };
    } catch (error) {
      this.logger.error(`Error deleting schema ${schemaName}: ${error.message}`);
      throw new InternalServerErrorException(`Failed to delete schema ${schemaName}`);
    }
  }

  async getSchemasByGroupId(groupId: string) {
    this.logger.log(`Fetching schemas for groupId: ${groupId}`);

    // First validate if the group exists and get its details
    const group = await this.connection.db
      .collection('groups')
      .findOne({ groupId });

    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }

    // Get all schemas that belong to this group
    const schemas = await this.connection.db
      .collection(this.schemaCollection)
      .find({ 'schema.groupId': groupId })
      .toArray();

    // Map the schemas and include only groupId and groupName
    const schemasWithGroup = schemas.map(schema => ({
      ...schema.schema,
      groupId: group.groupId,
      groupName: group.groupName
    }));

    return schemasWithGroup;
  }
}
