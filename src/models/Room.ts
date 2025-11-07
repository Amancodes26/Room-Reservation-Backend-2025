import mongoose, { Document, Schema } from 'mongoose';

export interface IAmenity {
  name: string;
  icon?: string;
}

export interface IRoom extends Document {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  capacity: number;
  pricePerHour: number;
  amenities: IAmenity[];
  imageUrl?: string;
  isActive: boolean;
  floor?: number;
  building?: string;
  createdAt: Date;
  updatedAt: Date;
}

const amenitySchema = new Schema<IAmenity>({
  name: {
    type: String,
    required: true,
  },
  icon: String,
}, { _id: false });

const roomSchema = new Schema<IRoom>(
  {
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      minlength: [2, 'Room name must be at least 2 characters'],
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      required: [true, 'Room description is required'],
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    capacity: {
      type: Number,
      required: [true, 'Room capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [1000, 'Capacity cannot exceed 1000'],
    },
    pricePerHour: {
      type: Number,
      required: [true, 'Price per hour is required'],
      min: [0, 'Price cannot be negative'],
    },
    amenities: {
      type: [amenitySchema],
      default: [],
    },
    imageUrl: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    floor: {
      type: Number,
      min: [0, 'Floor cannot be negative'],
    },
    building: {
      type: String,
      maxlength: [50, 'Building name cannot exceed 50 characters'],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (_doc, ret) {
        delete (ret as any).__v;
        return ret;
      },
    },
  }
);

// Indexes for better query performance
roomSchema.index({ name: 1 }, { unique: true }); // Single unique index instead of duplicate
roomSchema.index({ capacity: 1 });
roomSchema.index({ pricePerHour: 1 });
roomSchema.index({ isActive: 1 });

export const Room = mongoose.model<IRoom>('Room', roomSchema);
