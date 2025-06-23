import { Controller, Post, Body, Get, Param, Put, Delete, Query, BadRequestException } from '@nestjs/common';
import { SchemaService } from './schema.service';
import { CreateSchemaDto } from './dto/create-schema.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('schemas')
@Controller('schema')
export class SchemaController {
    constructor(private readonly schemaService: SchemaService) {}
    // Schema Management APIs
    @Post()
    createSchema(@Body() createSchemaDto: CreateSchemaDto) {
        return this.schemaService.createSchema(createSchemaDto);
    }

    @Put(':schemaName')
    updateSchema(
        @Param('schemaName') schemaName: string,
        @Body() updateSchemaDto: CreateSchemaDto
    ) {
        if (!schemaName) {
            throw new BadRequestException('Schema name is required');
        }
        return this.schemaService.updateSchema(schemaName, updateSchemaDto);
    }

    @Get()
    getAllSchemas() {
        return this.schemaService.getAllSchemas();
    }


    @Get('group/:groupId')
    getSchemasByGroupId(@Param('groupId') groupId: string) {
        if (!groupId) {
            throw new BadRequestException('Group ID is required');
        }
        return this.schemaService.getSchemasByGroupId(groupId);
    }


    @Get(':schemaName')
    getSchema(@Param('schemaName') schemaName: string) {
        if (!schemaName) {
            throw new BadRequestException('Schema name is required');
        }
        return this.schemaService.getSchema(schemaName);
    }


    @Delete(':schemaName')
    async deleteSchema(
        @Param('schemaName') schemaName: string,
        @Query('force') force: boolean = false
    ) {
        if (!schemaName) {
            throw new BadRequestException('Schema name is required');
        }
        return this.schemaService.deleteSchema(schemaName, force);
    }
}
