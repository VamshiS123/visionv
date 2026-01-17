# Mobile Troubleshooting Guide

If the app works on your laptop but not on your phone, check the following:

## 1. Environment Variables in Vercel

**Most Common Issue**: Environment variables are not set in Vercel.

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:
   - `VITE_OVERSHOOT_API_URL` (optional, defaults to cluster1.overshoot.ai)
   - `VITE_OVERSHOOT_API_KEY` (required)
   - `VITE_MURF_API_KEY` (required for voice narration)
   - `VITE_MURF_VOICE_ID` (optional, defaults to en-US-natalie)
4. **Redeploy** your application after adding environment variables

## 2. HTTPS Requirement

- Camera access requires HTTPS in production
- Vercel automatically provides HTTPS, but make sure you're accessing the app via the Vercel URL (not HTTP)
- Check that the URL starts with `https://`

## 3. Browser Compatibility

- **iOS**: Use Safari (Chrome on iOS uses Safari's engine)
- **Android**: Use Chrome or Firefox
- Make sure you're using a recent version of the browser

## 4. Camera Permissions

- When you click "Start", your browser will ask for camera permission
- **Allow** camera access when prompted
- If you denied it previously:
  - **iOS Safari**: Settings → Safari → Camera → Allow
  - **Android Chrome**: Settings → Site Settings → Camera → Allow

## 5. Network Issues

- Make sure you have a stable internet connection
- The app needs to connect to:
  - Overshoot API (for vision analysis)
  - Murf AI API (for voice narration)
- Check if your mobile network blocks these APIs

## 6. Debugging on Mobile

To see error messages on mobile:

### iOS Safari:
1. Connect iPhone to Mac via USB
2. On Mac: Safari → Develop → [Your iPhone] → [Your Site]
3. Check console for errors

### Android Chrome:
1. Open Chrome on Android
2. Go to `chrome://inspect`
3. Click "Inspect" next to your site
4. Check console for errors

## 7. Common Error Messages

- **"Camera access denied"**: Allow camera permissions in browser settings
- **"API key not configured"**: Set environment variables in Vercel
- **"Network error"**: Check internet connection
- **"Camera not found"**: Device doesn't have a camera or camera is in use

## 8. Quick Checklist

- [ ] Environment variables set in Vercel
- [ ] App redeployed after setting environment variables
- [ ] Accessing via HTTPS URL
- [ ] Camera permissions allowed
- [ ] Using a supported browser
- [ ] Stable internet connection
- [ ] Check browser console for specific errors
