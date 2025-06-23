import { Injectable, NotFoundException } from '@nestjs/common';
import { FilterQuery, Model, Types, UpdateQuery } from 'mongoose';

@Injectable()
export class BaseRepository<T> {
  constructor(private readonly model: Model<T>) { }

  /**
   * Generic function to find documents based on provided filters.
   * @param filters An object where keys are field names and values are the search values.
   * @returns Matching documents.
   */
  async findByFields(filters: Record<string, any>): Promise<T[]> {
    const query: FilterQuery<T> = {} as FilterQuery<T>; // ✅ Properly typed query

    for (const [key, value] of Object.entries(filters)) {
      if (Array.isArray(value)) {
        Object.assign(query, { [key]: { $in: value } }); // ✅ Handle `$in` for arrays
      } else if (typeof value === 'string' && Types.ObjectId.isValid(value)) {
        Object.assign(query, { [key]: new Types.ObjectId(value) }); // ✅ Convert valid string to ObjectId
      } else if (typeof value === 'object' && value !== null) {
        Object.assign(query, { [key]: value }); // ✅ Allow MongoDB operators like `$gte`, `$lte`
      } else {
        Object.assign(query, { [key]: value }); // ✅ Direct match for strings, numbers, booleans
      }
    }

    return this.model.find(query).exec();
  }

  /**
   * 🔹 Find a single document by ID.
   * @param id MongoDB ObjectId (string or ObjectId).
   */
  async findById(id: string | Types.ObjectId): Promise<T | null> {
    return this.model.findById(new Types.ObjectId(id)).exec();
  }

  async create(data: Partial<T>, session: any): Promise<T> {
    const newDoc = new this.model(data); // No `as any` needed
    return (await newDoc.save({session})).toObject() as T; // Ensures proper return type
  }

  /**
   * 🔹 Update a document by ID.
   * @param id Document ID.
   * @param updateData Data to update.
   */
  async updateById(id: string | Types.ObjectId, updateData: UpdateQuery<T>): Promise<T | null> {
    const existingDoc = await this.findById(id);
    if (!existingDoc) {
      throw new NotFoundException('Document not found');
    }

    // Merge existing data with incoming update data
    const mergedData = { ...existingDoc, ...updateData };

    return this.model.findByIdAndUpdate(id, mergedData, { new: true }).exec();
  }

  /**
   * 🔹 Delete a document by ID (Soft Delete if enabled).
   * @param id Document ID.
   */
  async deleteById(id: string | Types.ObjectId): Promise<T | null> {
    const doc = await this.model.findById(new Types.ObjectId(id));
    if (!doc) {
      throw new NotFoundException('Document not found');
    }

    if ('delete' in this.model.schema.methods) {
      // If soft delete (mongoose-delete) is enabled
      return (doc as any).delete();
    }

    return this.model.findByIdAndDelete(id).exec();
  }

  /**
   * 🔹 Restore a soft-deleted document (if using mongoose-delete).
   * @param id Document ID.
   */
  async restoreById(id: string | Types.ObjectId): Promise<T | null> {
    if (!('restore' in this.model.schema.methods)) {
      throw new Error('Soft delete is not enabled on this model');
    }

    return (this.model as any).restore({ _id: new Types.ObjectId(id) }).exec();
  }
}
