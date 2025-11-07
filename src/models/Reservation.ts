import mongoose, { Document, Schema } from 'mongoose';

export enum ReservationStatus {
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  CANCELLED = 'cancelled',
  COMPLETED = 'completed',
}

export interface IReservation extends Document {
  _id: mongoose.Types.ObjectId;
  user: mongoose.Types.ObjectId;
  room: mongoose.Types.ObjectId;
  startTime: Date;
  endTime: Date;
  status: ReservationStatus;
  purpose?: string;
  attendees?: number;
  totalPrice: number;
  createdAt: Date;
  updatedAt: Date;
}

const reservationSchema = new Schema<IReservation>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User is required'],
      index: true,
    },
    room: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: [true, 'Room is required'],
      index: true,
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
      index: true,
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ReservationStatus),
      default: ReservationStatus.CONFIRMED,
      index: true,
    },
    purpose: {
      type: String,
      maxlength: [200, 'Purpose cannot exceed 200 characters'],
    },
    attendees: {
      type: Number,
      min: [1, 'Attendees must be at least 1'],
    },
    totalPrice: {
      type: Number,
      required: [true, 'Total price is required'],
      min: [0, 'Total price cannot be negative'],
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

// Compound indexes for efficient queries
reservationSchema.index({ room: 1, startTime: 1, endTime: 1 });
reservationSchema.index({ user: 1, status: 1 });
reservationSchema.index({ startTime: 1, status: 1 });

// Validation: End time must be after start time
reservationSchema.pre('validate', function (next) {
  if (this.endTime <= this.startTime) {
    next(new Error('End time must be after start time'));
  } else {
    next();
  }
});

export const Reservation = mongoose.model<IReservation>('Reservation', reservationSchema);
