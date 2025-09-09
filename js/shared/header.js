/**
 * Universal Header Component
 * Provides consistent navigation and branding across all pages
 */

class UniversalHeader {
    constructor() {
        this.currentPage = this.getCurrentPage();
        this.init();
    }

    getCurrentPage() {
        const path = window.location.pathname;
        if (path === '/' || path === '/index.html') return 'home';
        if (path.includes('fbstationtest')) return 'stations';
        return 'unknown';
    }

    init() {
        this.createHeader();
        this.setupThemeToggle();
        this.setupNavigation();
    }

    createHeader() {
        const headerHTML = `
            <header class="universal-header">
                <div class="header-container">
                    <div class="header-left">
                        <a href="index.html" class="logo-link">
                            <div class="logo">
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M3 12h18M3 6h18M3 18h18"/>
                                    <circle cx="6" cy="12" r="2"/>
                                    <circle cx="18" cy="12" r="2"/>
                                </svg>
                                <span>Rail Statistics</span>
                            </div>
                        </a>
                    </div>
                    
                    <nav class="header-nav" id="header-nav">
                        <a href="index.html" class="nav-link ${this.currentPage === 'home' ? 'active' : ''}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                                <polyline points="9,22 9,12 15,12 15,22"/>
                            </svg>
                            <span>Home</span>
                        </a>
                        <a href="fbstationtest.html" class="nav-link ${this.currentPage === 'stations' ? 'active' : ''}">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <polyline points="14,2 14,8 20,8"/>
                                <line x1="16" y1="13" x2="8" y2="13"/>
                                <line x1="16" y1="17" x2="8" y2="17"/>
                                <polyline points="10,9 9,9 8,9"/>
                            </svg>
                            <span>Stations</span>
                        </a>
                    </nav>
                    
                    <div class="header-right">
                        <button id="theme-toggle" class="theme-toggle" aria-label="Toggle theme">
                            <svg class="sun-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="12" cy="12" r="5"/>
                                <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
                            </svg>
                            <svg class="moon-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                            </svg>
                        </button>
                        
                        <!-- Mobile Menu Button -->
                        <button class="mobile-menu-toggle" id="mobile-menu-toggle" aria-label="Toggle navigation menu">
                            <span class="hamburger-line"></span>
                            <span class="hamburger-line"></span>
                            <span class="hamburger-line"></span>
                        </button>
                    </div>
                </div>
            </header>
        `;

        // Insert header at the beginning of the body
        document.body.insertAdjacentHTML('afterbegin', headerHTML);
    }

    setupThemeToggle() {
        const themeToggle = document.getElementById('theme-toggle');
        const body = document.body;
        
        // Check for saved theme preference or default to light mode
        const savedTheme = localStorage.getItem('theme') || 'light';
        body.setAttribute('data-theme', savedTheme);
        
        // Update toggle button state
        this.updateToggleIcon(savedTheme);
        
        // Theme toggle event listener
        themeToggle.addEventListener('click', () => {
            const currentTheme = body.getAttribute('data-theme');
            const newTheme = currentTheme === 'light' ? 'dark' : 'light';
            
            body.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            this.updateToggleIcon(newTheme);
        });
    }

    updateToggleIcon(theme) {
        const themeToggle = document.getElementById('theme-toggle');
        const sunIcon = themeToggle.querySelector('.sun-icon');
        const moonIcon = themeToggle.querySelector('.moon-icon');
        
        if (theme === 'light') {
            sunIcon.style.display = 'block';
            moonIcon.style.display = 'none';
        } else {
            sunIcon.style.display = 'none';
            moonIcon.style.display = 'block';
        }
    }

    setupNavigation() {
        // Add smooth scrolling for anchor links
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                e.preventDefault();
                const target = document.querySelector(this.getAttribute('href'));
                if (target) {
                    target.scrollIntoView({
                        behavior: 'smooth',
                        block: 'start'
                    });
                }
            });
        });

        // Setup mobile menu
        this.setupMobileMenu();

        // Mobile-specific enhancements
        this.setupMobileOptimizations();
    }

    setupMobileMenu() {
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const headerNav = document.getElementById('header-nav');
        const body = document.body;

        if (mobileMenuToggle && headerNav) {
            mobileMenuToggle.addEventListener('click', () => {
                const isOpen = headerNav.classList.contains('mobile-open');
                
                if (isOpen) {
                    this.closeMobileMenu();
                } else {
                    this.openMobileMenu();
                }
            });

            // Close menu when clicking on nav links
            headerNav.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => {
                    this.closeMobileMenu();
                });
            });

            // Close menu when clicking outside
            document.addEventListener('click', (e) => {
                if (!headerNav.contains(e.target) && !mobileMenuToggle.contains(e.target)) {
                    this.closeMobileMenu();
                }
            });

            // Close menu on escape key
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    this.closeMobileMenu();
                }
            });
        }
    }

    openMobileMenu() {
        const headerNav = document.getElementById('header-nav');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const body = document.body;

        if (headerNav && mobileMenuToggle) {
            headerNav.classList.add('mobile-open');
            mobileMenuToggle.classList.add('active');
            body.classList.add('mobile-menu-open');
        }
    }

    closeMobileMenu() {
        const headerNav = document.getElementById('header-nav');
        const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
        const body = document.body;

        if (headerNav && mobileMenuToggle) {
            headerNav.classList.remove('mobile-open');
            mobileMenuToggle.classList.remove('active');
            body.classList.remove('mobile-menu-open');
        }
    }

    setupMobileOptimizations() {
        // Prevent zoom on double tap for iOS
        let lastTouchEnd = 0;
        document.addEventListener('touchend', function (event) {
            const now = (new Date()).getTime();
            if (now - lastTouchEnd <= 300) {
                event.preventDefault();
            }
            lastTouchEnd = now;
        }, false);

        // Improve touch feedback
        document.querySelectorAll('.nav-link, .theme-toggle, .cta-button').forEach(element => {
            element.addEventListener('touchstart', function() {
                this.style.transform = 'scale(0.98)';
            });
            
            element.addEventListener('touchend', function() {
                this.style.transform = '';
            });
        });

        // Handle orientation change
        window.addEventListener('orientationchange', () => {
            setTimeout(() => {
                window.scrollTo(0, 0);
            }, 100);
        });
    }
}

// Auto-initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new UniversalHeader();
});
