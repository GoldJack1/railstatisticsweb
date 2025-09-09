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

### Firebase Emulator (Optional)
To use Firebase emulator for local development:
```env
VITE_USE_FIREBASE_EMULATOR=true
```

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
3. **Environment Variables**: Set Firebase configuration in Netlify dashboard

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