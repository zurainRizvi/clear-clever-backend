import { Router } from 'express';
import {
  asyncHandler,
  forgotPassword,
  getMe,
  login,
  resetPassword,
  sendOtp,
  setRole,
  signup,
  updateMe,
  verifyOtp,
} from '../controllers/authController';
import { authenticate } from '../middleware/authenticate';
import { validate } from '../middleware/validate';
import {
  forgotPasswordValidators,
  loginValidators,
  otpSendValidators,
  otpVerifyValidators,
  resetPasswordValidators,
  setRoleValidators,
  signupValidators,
  updateMeValidators,
} from '../validators/authValidators';

export const authRouter = Router();

authRouter.post('/signup', validate(signupValidators), asyncHandler(signup));
authRouter.post('/forgot-password', validate(forgotPasswordValidators), asyncHandler(forgotPassword));
authRouter.post('/reset-password', validate(resetPasswordValidators), asyncHandler(resetPassword));
authRouter.post('/otp/send', validate(otpSendValidators), asyncHandler(sendOtp));
authRouter.post('/otp/verify', validate(otpVerifyValidators), asyncHandler(verifyOtp));
authRouter.post('/login', validate(loginValidators), asyncHandler(login));
authRouter.get('/me', authenticate, asyncHandler(getMe));
authRouter.patch('/me', authenticate, validate(updateMeValidators), asyncHandler(updateMe));
authRouter.patch('/role', authenticate, validate(setRoleValidators), asyncHandler(setRole));
