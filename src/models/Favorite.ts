import mongoose, { Schema, type Document, type Model, type Types } from 'mongoose';

export interface IFavorite {
  userId: Types.ObjectId;
  policyId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface IFavoriteDocument extends IFavorite, Document {}

const favoriteSchema = new Schema<IFavoriteDocument>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    policyId: { type: Schema.Types.ObjectId, ref: 'Policy', required: true, index: true },
  },
  { timestamps: true }
);

favoriteSchema.index({ userId: 1, policyId: 1 }, { unique: true });

export const Favorite: Model<IFavoriteDocument> =
  mongoose.models.Favorite ?? mongoose.model<IFavoriteDocument>('Favorite', favoriteSchema);
