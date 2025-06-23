import { Injectable, NotFoundException, Logger, BadRequestException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Group } from './entities/group.entity';
import { CreateGroupDto } from './dto/create-group.dto';
import { UpdateGroupDto } from './dto/update-group.dto';
import { nanoidGenerator } from 'src/utility/nanoid.util';

@Injectable()
export class GroupService {
  private readonly logger = new Logger(GroupService.name);

  constructor(
    @InjectModel(Group.name) private readonly groupModel: Model<Group>,
  ) {}

  async create(createGroupDto: CreateGroupDto): Promise<Group> {
    try {
      const group = new this.groupModel({
        ...createGroupDto,
        groupId: nanoidGenerator.generate()
      });
      return await group.save();
    } catch (error) {
      if (error.code === 11000) {
        throw new BadRequestException('Group name already exists');
      }
      throw error;
    }
  }

  async findAll(): Promise<Group[]> {
    return this.groupModel.find().exec();
  }

  async findOne(groupId: string): Promise<Group> {
    const group = await this.groupModel.findOne({ groupId }).exec();
    if (!group) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }
    return group;
  }

  async update(groupId: string, updateGroupDto: UpdateGroupDto): Promise<Group> {
    const updatedGroup = await this.groupModel
      .findOneAndUpdate({ groupId }, updateGroupDto, { new: true })
      .exec();
    if (!updatedGroup) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }
    return updatedGroup;
  }

  async remove(groupId: string): Promise<void> {
    const result = await this.groupModel.deleteOne({ groupId }).exec();
    if (result.deletedCount === 0) {
      throw new NotFoundException(`Group with ID ${groupId} not found`);
    }
  }
} 