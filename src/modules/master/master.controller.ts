import { Controller, Post, Body, Get, Param, Put, Delete, Query, BadRequestException } from '@nestjs/common';
import { MasterService } from './master.service';
import { CreateSchemaDto } from '../schema/dto/create-schema.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';

@ApiTags("Master")
@Controller('master')
export class MasterController {
  constructor(private readonly masterService: MasterService) {}

  @Post(':masterName/data')
  createData(
    @Param('masterName') masterName: string,
    @Body() data: any
  ) {
    if (!masterName) {
      throw new BadRequestException('Schema name is required');
    }
    return this.masterService.createData(masterName, data);
  }

  @Get(':masterName/data')
  findAll(
    @Param('masterName') masterName: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 10,
    @Query('sort') sort: string = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
    @Query('search') search?: string,
    @Query('filters') filters?: string
  ) {
    if (!masterName) {
      throw new BadRequestException('Schema name is required');
    }
    return this.masterService.findAll(masterName, {
      page,
      limit,
      sort,
      order,
      search,
      filters: filters ? JSON.parse(filters) : undefined
    });
  }


  @Get(':masterName/data/:id')
  findOne(
    @Param('masterName') masterName: string,
    @Param('id') id: string
  ) {
    if (!masterName || !id) {
      throw new BadRequestException('Schema name and ID are required');
    }
    return this.masterService.findOne(masterName, id);
  }

  
  @Put(':masterName/data/:id')
  update(
    @Param('masterName') masterName: string,
    @Param('id') id: string,
    @Body() data: any
  ) {
    if (!masterName || !id) {
      throw new BadRequestException('Schema name and ID are required');
    }
    return this.masterService.update(masterName, id, data);
  }

  
  @Delete(':masterName/data/:id')
  remove(
    @Param('masterName') masterName: string,
    @Param('id') id: string
  ) {
    if (!masterName || !id) {
      throw new BadRequestException('Schema name and ID are required');
    }
    return this.masterService.remove(masterName, id);
  }
}
