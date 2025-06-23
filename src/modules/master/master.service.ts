import { Injectable, Logger, BadRequestException, NotFoundException, OnModuleInit } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Schema, Model } from 'mongoose';
import { CreateSchemaDto } from '../schema/dto/create-schema.dto';
import { SchemaService } from '../schema/schema.service';
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
export class MasterService implements OnModuleInit {
  private readonly logger = new Logger(MasterService.name);
  private schemaCache: Map<string, { schema: CreateSchemaDto; model: any }> = new Map();

  constructor(
    @InjectConnection() private readonly connection: Connection,
    private readonly schemaService: SchemaService,
    private eventEmitter: EventEmitter2
  ) {
    this.logger.log('MasterService initialized');
  }

  async onModuleInit() {
    // Initialize schema cache
    await this.initializeSchemaCache();

    // Listen for schema changes
    this.eventEmitter.on('schema.created', this.handleSchemaCreated.bind(this));
    this.eventEmitter.on('schema.updated', this.handleSchemaUpdated.bind(this));
  }

  private async initializeSchemaCache() {
    try {
      const schemas = await this.schemaService.getAllSchemas();
      
      for (const schema of schemas) {
        const schemaName = schema.name.toLowerCase();
        const schemaDefinition = this.buildSchemaDefinition(schema);
        const mongooseSchema = new Schema(schemaDefinition);
        const Model = this.connection.model(schemaName, mongooseSchema, schemaName);
        
        this.schemaCache.set(schemaName, {
          schema,
          model: Model
        });
      }
    } catch (error) {
      this.logger.error('Error initializing schema cache:', error);
    }
  }

  private async handleSchemaCreated(payload: { schemaName: string; schema: CreateSchemaDto }) {
    this.logger.log(`Schema created: ${payload.schemaName}`);
    await this.updateSchemaCache(payload.schemaName, payload.schema);
  }

  private async handleSchemaUpdated(payload: { schemaName: string; schema: CreateSchemaDto }) {
    this.logger.log(`Schema updated: ${payload.schemaName}`);
    await this.updateSchemaCache(payload.schemaName, payload.schema);
  }

  private async updateSchemaCache(schemaName: string, schema: CreateSchemaDto) {
    const schemaNameLower = schemaName.toLowerCase();
    const schemaDefinition = this.buildSchemaDefinition(schema);
    const mongooseSchema = new Schema(schemaDefinition);
    
    // Remove existing model if it exists
    if (this.connection.models[schemaNameLower]) {
      // Use deleteModel instead of direct deletion
      this.connection.deleteModel(schemaNameLower);
    }
    
    const Model = this.connection.model(schemaNameLower, mongooseSchema, schemaNameLower);
    
    this.schemaCache.set(schemaNameLower, {
      schema,
      model: Model
    });
    
    this.logger.log(`Updated schema cache for: ${schemaNameLower}`);
  }

  private getModel(schemaName: string) {
    const schemaNameLower = schemaName.toLowerCase();
    const cached = this.schemaCache.get(schemaNameLower);
    
    if (!cached) {
      throw new NotFoundException(`Schema ${schemaName} does not exist`);
    }
    
    return cached.model;
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
      if (field.type === 'master') {
        const fieldName = `${field.masterType.toLowerCase()}Id`;
        schemaDefinition[fieldName] = {
          type: String,
          required: field.required || false,
          ref: field.masterType.toLowerCase()
        };
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

  async createData(schemaName: string, data: any) {
    this.logger.log(`Creating data for schema: ${schemaName}`);
    this.logger.log(`Data: ${JSON.stringify(data)}`);
    
    const Model = this.getModel(schemaName);
    
    // Get schema definition from cache
    const schemaDef = this.schemaCache.get(schemaName.toLowerCase())?.schema;
    if (!schemaDef) {
      throw new NotFoundException(`Schema ${schemaName} not found in cache`);
    }

    this.logger.log(`Schema definition: ${JSON.stringify(schemaDef)}`);

    // Remove any attempt to set the auto-generated ID
    const idFieldName = `${schemaName.toLowerCase()}Id`;
    delete data[idFieldName];

    // Validate and convert field types
    const convertedData = {};
    for (const field of schemaDef.fields) {
      this.logger.log(`Validating field: ${field.name}, type: ${field.type}, required: ${field.required}`);
      const value = data[field.name];
      
      // Skip if field is not provided and not required
      if (value === undefined && !field.required) {
        this.logger.log(`Skipping optional field: ${field.name}`);
        continue;
      }

      // Validate required fields
      if (field.required && value === undefined) {
        this.logger.log(`Required field missing: ${field.name}`);
        throw new BadRequestException(`Field ${field.name} is required`);
      }

      // Skip type validation for MASTER type fields as they are handled by validateMasterReferences
      if (field.type === 'master') {
        convertedData[field.name] = value;
        continue;
      }

      // Type conversion and validation
      try {
        switch (field.type) {
          case 'number':
            if (value !== undefined) {
              const num = Number(value);
              if (isNaN(num)) {
                throw new BadRequestException(`Field ${field.name} must be a valid number`);
              }
              convertedData[field.name] = num;
            }
            break;

          case 'boolean':
            if (value !== undefined) {
              if (typeof value === 'string') {
                convertedData[field.name] = value.toLowerCase() === 'true';
              } else {
                convertedData[field.name] = Boolean(value);
              }
            }
            break;

          case 'date':
            if (value !== undefined) {
              const date = new Date(value);
              if (isNaN(date.getTime())) {
                throw new BadRequestException(`Field ${field.name} must be a valid date`);
              }
              convertedData[field.name] = date;
            }
            break;

          case 'array':
            if (value !== undefined && !Array.isArray(value)) {
              throw new BadRequestException(`Field ${field.name} must be an array`);
            }
            convertedData[field.name] = value;
            break;

          case 'object':
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

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (filters) {
      Object.assign(query, filters);
    }

    const [data, total] = await Promise.all([
      Model.find(query)
        .sort({ [sort]: order === 'desc' ? -1 : 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Model.countDocuments(query)
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async findOne(schemaName: string, id: string) {
    const Model = this.getModel(schemaName);
    const data = await Model.findOne({ [`${schemaName.toLowerCase()}Id`]: id });
    
    if (!data) {
      throw new NotFoundException(`Data with ID ${id} not found`);
    }
    
    return data;
  }

  async update(schemaName: string, id: string, data: any) {
    const Model = this.getModel(schemaName);
    const updated = await Model.findOneAndUpdate(
      { [`${schemaName.toLowerCase()}Id`]: id },
      { $set: data },
      { new: true }
    );
    
    if (!updated) {
      throw new NotFoundException(`Data with ID ${id} not found`);
    }
    
    return updated;
  }

  async remove(schemaName: string, id: string) {
    const Model = this.getModel(schemaName);
    const deleted = await Model.findOneAndDelete({ [`${schemaName.toLowerCase()}Id`]: id });
    
    if (!deleted) {
      throw new NotFoundException(`Data with ID ${id} not found`);
    }
    
    return { message: 'Data deleted successfully' };
  }

  private async validateMasterReferences(schemaName: string, data: any) {
    const schemaDef = this.schemaCache.get(schemaName.toLowerCase())?.schema;
    if (!schemaDef) {
      throw new NotFoundException(`Schema ${schemaName} not found in cache`);
    }

    for (const field of schemaDef.fields) {
      if (field.type === 'master' && data[field.name]) {
        const masterType = field.masterType.toLowerCase();
        const masterModel = this.getModel(masterType);
        const masterId = data[field.name];

        // For array of references
        if (Array.isArray(masterId)) {
          for (const id of masterId) {
            const exists = await masterModel.exists({ [`${masterType}Id`]: id });
            if (!exists) {
              throw new BadRequestException(
                `Invalid reference: ${id} does not exist in ${masterType}`
              );
            }
          }
        } 
        // For single reference
        else {
          const exists = await masterModel.exists({ [`${masterType}Id`]: masterId });
          if (!exists) {
            throw new BadRequestException(
              `Invalid reference: ${masterId} does not exist in ${masterType}`
            );
          }
        }
      }
    }
  }
}
