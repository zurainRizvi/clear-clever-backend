import { Router } from 'express';
import {
  asyncHandler,
  getMe,
  login,
  sendOtp,
  setRole,
  signup,
  updateMe,
  verifyOtp,
} from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  loginValidators,
  otpSendValidators,
  otpVerifyValidators,
  setRoleValidators,
  signupValidators,
  updateMeValidators,
} from '../validators/authValidators';

export const authRouter = Router();

authRouter.post('/signup', validate(signupValidators), asyncHandler(signup));
authRouter.post('/otp/send', validate(otpSendValidators), asyncHandler(sendOtp));
authRouter.post('/otp/verify', validate(otpVerifyValidators), asyncHandler(verifyOtp));
authRouter.post('/login', validate(loginValidators), asyncHandler(login));
authRouter.get('/me', authenticate, asyncHandler(getMe));
authRouter.patch('/me', authenticate, validate(updateMeValidators), asyncHandler(updateMe));
authRouter.patch('/role', authenticate, validate(setRoleValidators), asyncHandler(setRole));
