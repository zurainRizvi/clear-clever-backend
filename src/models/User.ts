import mongoose, { Schema, type Document, type Model } from 'mongoose';
import type { UserRole, UserStatus } from '../constants/roles';

export interface IUser {
  fullName: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {}

const userSchema = new Schema<IUserDocument>(
  {
    fullName: { type: String, required: true, trim: true, maxlength: 120 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: 254,
    },
    phone: { type: String, required: true, trim: true, maxlength: 20 },
    passwordHash: { type: String, required: true, select: false },
    role: {
      type: String,
      enum: ['user', 'insurer', 'admin', 'superadmin'],
      default: 'user',
    },
    status: {
      type: String,
      enum: ['pendingVerification', 'active', 'inactive'],
      default: 'pendingVerification',
    },
  },
  { timestamps: true }
);

export const User: Model<IUserDocument> =
  mongoose.models.User ?? mongoose.model<IUserDocument>('User', userSchema);
