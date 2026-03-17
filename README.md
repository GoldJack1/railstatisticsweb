# Rail Statistics - React Application

A modern React application for railway station tracking with Firebase integration, TypeScript support, and real-time capabilities.

## 🚀 Features

- **React 18** with modern hooks and functional components
- **TypeScript** for type safety and better development experience
- **Firebase Firestore** for real-time data synchronization
- **Vite** for fast development and optimized builds
- **Responsive Design** with modern CSS and mobile support
- **Real-time Updates** with Firebase integration
- **Local Data Fallback** for offline development

## 📱 Responsive breakpoints

This project intentionally uses **only 3 responsive tiers**:

- **Mobile**: `<= 639px`
- **Tablet**: `640px–1023px`
- **Desktop**: `>= 1024px`

To keep things consistent, viewport-width media queries should only use:

- `@media (max-width: 1023px)` (tablet and down)
- `@media (max-width: 639px)` (mobile only)

## 🛠️ Development

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation
```bash
npm install
```

### Development Commands
```bash
# Start development server
npm run dev

# Type checking
npm run type-check

# Build for production
npm run build

# Preview production build
npm run preview

# Lint code
npm run lint
```

## 🔥 Firebase Configuration

The application uses Firebase for data storage and real-time updates. Configuration is handled through environment variables:

### Environment Variables
```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=rail-statistics.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://rail-statistics-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=rail-statistics
VITE_FIREBASE_STORAGE_BUCKET=rail-statistics.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Local Development
For local development, create a `.env.local` file with your Firebase configuration values.

**Important:** Local development now expects Firebase to be configured and will **not** automatically fall back to `public/data/*.json` if Firebase is unavailable/misconfigured.

### Firebase Emulator (Optional)
To use Firebase emulator for local development:
```env
VITE_USE_FIREBASE_EMULATOR=true
```

### Firebase App Check (Firestore protection)
App Check uses reCAPTCHA v3 to ensure only your app can access Firestore.

- **Site key** (public): set in `.env.local` and in Netlify as `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY`.
- **Secret key**: never put in code. In [Firebase Console](https://console.firebase.google.com) → **App Check** → your web app → **reCAPTCHA v3** → paste the **secret key** there.

To enforce App Check for Firestore: **App Check** → **APIs** → **Cloud Firestore** → turn **Enforce** on (you can use “Monitor” first to confirm tokens are valid).

### Sign in with Google and Apple
The login page supports Email/Password, **Google**, and **Apple**. No extra env vars are needed in the app.

**Step-by-step setup:** see **[docs/SETUP_GOOGLE_APPLE_SIGNIN.md](docs/SETUP_GOOGLE_APPLE_SIGNIN.md)** for full instructions.

- **Google**: Create a Web OAuth client in [Google Cloud Console](https://console.cloud.google.com), then in Firebase → **Authentication** → **Sign-in method** → **Google** enter the Web client ID and secret.
- **Apple**: Configure Sign in with Apple in [Apple Developer](https://developer.apple.com) (Services ID, key), then in Firebase → **Authentication** → **Sign-in method** → **Apple** enter Service ID, Team ID, Key ID, and private key. Details in the guide above.

## 📁 Project Structure

```
src/
├── components/          # React components
│   ├── Header.tsx      # Navigation header
│   ├── Home.tsx        # Home page
│   └── Stations.tsx    # Stations listing page
├── hooks/              # Custom React hooks
│   ├── useStations.js  # Station data management
│   └── useTheme.js     # Theme management
├── services/           # External service integrations
│   ├── firebase.js     # Firebase configuration
│   └── localData.js    # Local data service
├── types/              # TypeScript type definitions
│   └── index.ts        # All type definitions
├── styles/             # CSS files
├── App.tsx             # Main app component
└── main.tsx            # Entry point
```

## 🚀 Deployment

### Netlify (Recommended)
The application is configured for Netlify deployment:

1. **Build Command**: `npm run build`
2. **Publish Directory**: `dist`
3. **Environment Variables**: Set Firebase configuration and `VITE_FIREBASE_APP_CHECK_RECAPTCHA_SITE_KEY` (reCAPTCHA v3 site key) in Netlify dashboard

### Manual Deployment
```bash
# Build the application
npm run build

# Deploy the dist folder to your hosting provider
```

## 🔧 Configuration

### Firebase Security Rules
The application includes Firestore security rules for:
- Public read access to station data
- Admin write access for data management
- User data protection

### TypeScript Configuration
- Strict mode enabled for maximum type safety
- Modern ES2020 target
- React JSX support

## 📊 Data Structure

### Station Data
```typescript
interface Station {
  id: string
  stationName: string
  crsCode: string
  latitude: number
  longitude: number
  country: string
  county: string
  toc: string
  stnarea: string
  yearlyPassengers: YearlyPassengers
}
```

### Statistics
```typescript
interface StationStats {
  totalStations: number
  withCoordinates: number
  withTOC: number
  withPassengers: number
}
```

## 🧪 Testing

### Type Checking
```bash
npm run type-check
```

### Code Quality
```bash
npm run lint
```

## 📄 License

MIT License - see LICENSE file for details

---

Built with ❤️ using modern React, TypeScript, and Firebase technologies for railway enthusiasts.