import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { GroupService } from './group.service';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { ApiTags, ApiOperation, ApiResponse, ApiParam } from '@nestjs/swagger';

@ApiTags('groups')
@Controller('groups')
export class GroupController {
  constructor(private readonly groupService: GroupService) {}

  @Post()
  create(@Body() createGroupDto: CreateGroupDto) {
    return this.groupService.create(createGroupDto);
  }


  @Get()
  findAll() {
    return this.groupService.findAll();
  }


  @Get(':groupId')
  findOne(@Param('groupId') groupId: string) {
    return this.groupService.findOne(groupId);
  }

  @Patch(':groupId')
  update(
    @Param('groupId') groupId: string,
    @Body() updateGroupDto: UpdateGroupDto,
  ) {
    return this.groupService.update(groupId, updateGroupDto);
  }

  @Delete(':groupId')
  remove(@Param('groupId') groupId: string) {
    return this.groupService.remove(groupId);
  }
}  