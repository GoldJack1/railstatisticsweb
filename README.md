# Rail Statistics - Landing Page

A simple, modern landing page for the Rail Statistics application with Firebase integration.

## Features

- **Modern Design**: Clean, responsive landing page with railway theme
- **Firebase Integration**: Real-time connection testing and status display
- **Responsive Layout**: Works perfectly on desktop, tablet, and mobile
- **Interactive Elements**: Status updates and user notifications
- **Fast Loading**: Optimized for quick loading and smooth user experience

## Getting Started

### Local Development

1. **Clone the repository:**
   ```bash
   git clone https://github.com/GoldJack1/railstatisticsweb.git
   cd railstatisticsweb
   ```

2. **Start the development server:**
   ```bash
   npm start
   # or
   python3 -m http.server 8000
   ```

3. **Open your browser:**
   - Navigate to `http://localhost:8000`
   - You'll see the Rail Statistics landing page

### Testing Firebase Connection

1. Click the "Get Started" button on the landing page
2. The system will test the Firebase connection
3. Status updates will show in real-time
4. Success/error notifications will appear

## Project Structure

```
railstatisticsweb/
├── index.html              # Main landing page
├── styles.css              # Styling and responsive design
├── build.js                # Build script for production
├── package.json            # Project configuration
├── netlify.toml            # Netlify deployment configuration
├── firebase-config.template.js  # Firebase configuration template
└── js/
    └── shared/
        └── firebase.js     # Firebase service and connection logic
```

## Firebase Configuration

The application uses Firebase for backend services. Configuration is handled through:

- **Environment Variables**: For production deployment (Netlify)
- **Template File**: `firebase-config.template.js` for local development

### Environment Variables (Production)

Set these in your Netlify site settings:

- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_DATABASE_URL`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID`

## Deployment

### Netlify (Recommended)

1. **Connect your repository** to Netlify
2. **Set build settings:**
   - Build command: `npm run build`
   - Publish directory: `.` (root)
3. **Add environment variables** (see Firebase Configuration)
4. **Deploy!**

The site will be available at `https://your-site-name.netlify.app`

## Development

### Available Scripts

- `npm start` - Start local development server
- `npm run build` - Build for production (injects environment variables)
- `npm run serve` - Alternative server start command

### Technologies Used

- **HTML5** - Semantic markup
- **CSS3** - Modern styling with flexbox/grid
- **JavaScript (ES6+)** - Interactive functionality
- **Firebase** - Backend services
- **Font Awesome** - Icons
- **Python HTTP Server** - Local development

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile browsers (iOS Safari, Chrome Mobile)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test locally
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- Open an issue on GitHub
- Check the Firebase documentation
- Review the Netlify deployment guide

---

Built with ❤️ for railway enthusiasts.