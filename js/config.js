// =============================================================================
// INTRODUCTION DINO - CONFIGURATION
// Soothing, fullscreen, elegant portfolio game settings
// =============================================================================

export const CONFIG = {
  // ---------------------------------------------------------------------------
  // Social Profiles & Destinations
  // ---------------------------------------------------------------------------
  socialProfiles: {
    instagram: 'https://www.instagram.com/_.prashant.me/',
    linkedin: 'https://www.linkedin.com/in/24f2001089/',
    github: 'https://github.com/Techy-prashant',
    portfolio: 'https://portfolio-v3-ten-gray.vercel.app/',
    email: 'pt286355@gmail.com',
  },

  // ---------------------------------------------------------------------------
  // Personal Introduction Checkpoints (13 Milestones)
  //
  // HOW TO CUSTOMIZE:
  // - text:      Edit the message text inside the quotes.
  // - milestone: The score point where this discovery reaches the center.
  // - duration:  (Optional) How many score points this discovery lasts. If omitted,
  //              the system automatically sets it based on the next milestone.
  // - link:      Clickable destination URL when clicked.
  // - image:     Path to accompanying photograph.
  // - tilt:      Clockwise tilt in degrees (e.g. 2.2 for subtle, 3.2 for intro).
  // ---------------------------------------------------------------------------
  checkpoints: [
    {
      id: 1,
      milestone: 25,
      text: "Hey... I'm Prashant Tiwari.",
      image: "assets/intro/intro_01_prashant.png",
      remoteImage: "https://raw.githubusercontent.com/Techy-prashant/images_workIITM/refs/heads/main/intro-dino/Screenshot%202026-10-31%20182018.png",
      tilt: 3.2, // ~3 degrees clockwise tilt for intro photograph
    },
    {
      id: 2,
      milestone: 85, // ~60 pts gap (customizable)
      text: "This is a website for my little introduction.",
    },
    {
      id: 3,
      milestone: 145,
      text: "I'm currently studying at IIT Madras, pursuing my Bachelor's in Data Science.",
      image: "assets/intro/intro_03_iitm.png",
      remoteImage: "https://raw.githubusercontent.com/Techy-prashant/images_workIITM/refs/heads/main/intro-dino/d6ff0e62-4397-4737-b079-864d7bcf3f7d.png",
      tilt: 2.2, // ~2.2 degrees subtle tilt
    },
    {
      id: 4,
      milestone: 205,
      text: "I'm into creative and technical Domains.",
    },
    {
      id: 5,
      milestone: 265,
      text: "I've been part of communities and startups across various technical and creative domains.",
    },
    {
      id: 6,
      milestone: 325,
      text: "Here's my Instagram. No posts btw.",
      image: "assets/intro/intro_06_instagram.png",
      remoteImage: "https://raw.githubusercontent.com/Techy-prashant/images_workIITM/refs/heads/main/intro-dino/Screenshot%202026-10-31%20161054.png",
      link: "https://www.instagram.com/_.prashant.me/",
      showClickMe: true,
      tilt: 2.2,
    },
    {
      id: 7,
      milestone: 385,
      text: "Ah and here's my LinkedIn.",
      image: "assets/intro/intro_07_linkedin.png",
      remoteImage: "https://raw.githubusercontent.com/Techy-prashant/images_workIITM/refs/heads/main/intro-dino/Screenshot%202026-10-31%20181341.png",
      link: "https://www.linkedin.com/in/24f2001089/",
      showClickMe: true,
      tilt: 2.2,
    },
    {
      id: 8,
      milestone: 445,
      text: "And finally, here's my GitHub.",
      image: "assets/intro/intro_08_github.png",
      remoteImage: "https://raw.githubusercontent.com/Techy-prashant/images_workIITM/refs/heads/main/intro-dino/Screenshot%202026-10-31%20181442.png",
      link: "https://github.com/Techy-prashant",
      showClickMe: true,
      tilt: 2.2,
    },
    {
      id: 9,
      milestone: 505,
      text: "Want to see what else I've been building?",
      image: "assets/intro/intro_09_portfolio.png",
      remoteImage: "https://raw.githubusercontent.com/Techy-prashant/images_workIITM/refs/heads/main/intro-dino/Screenshot%202026-10-31%20182943.png",
      link: "https://portfolio-v3-ten-gray.vercel.app/",
      showClickMe: true,
      tilt: 2.2,
    },
    {
      id: 10,
      milestone: 565,
      text: "I'm open to work in internships, fellowships, apprenticeships, research, freelancing and exciting projects.",
    },
    {
      id: 11,
      milestone: 625,
      text: "If you have something interesting in mind, let's connect.",
      email: "pt286355@gmail.com",
    },
    {
      id: 12,
      milestone: 685,
      text: "Prashant's life is just getting started and he will continue to Grow...",
    },
    {
      id: 13,
      milestone: 745,
      text: "This is the last one btw. You can leave or enjoy the game :)",
      isFinal: true,
    }
  ],

  // ---------------------------------------------------------------------------
  // Game Physics & Pacing (Slightly snappier start, moderate jump, generous gaps)
  // ---------------------------------------------------------------------------
  game: {
    fps: 60,
    speed: 4.2,                  // Slightly increased starting pace (closer to comfortable cruising speed)
    maxSpeed: 6.8,               // Preserved comfortable maximum speed ceiling
    acceleration: 0.00012,       // Very gradual, seamless progression
    gapCoefficient: 1.2,         // Generous obstacle spacing
    minObstacleGap: 450,         // Minimum distance in px between obstacles
    gravity: 0.48,               // Moderately adjusted gravity for natural jump arc
    initialJumpVelocity: -8.8,   // Moderately reduced jump height for effortless feel
    dropVelocity: -4.0,
    speedDropCoefficient: 2.8,
    minJumpHeight: 28,
    maxJumpHeight: 70,
    clearTime: 3000,
  },

  // ---------------------------------------------------------------------------
  // Day / Night Mode Transitions (Every 700 points)
  // ---------------------------------------------------------------------------
  nightMode: {
    invertDistance: 700,
    moonSpeed: 0.2,
  },

  // ---------------------------------------------------------------------------
  // Resume & Safe Window Configuration
  // ---------------------------------------------------------------------------
  resume: {
    enabled: true,
    safeWindowDuration: 1500,     // 1.5s invulnerability upon resume
    obstacleClearDistance: 500,   // Clears obstacles within 500px of dinosaur
  },

  // ---------------------------------------------------------------------------
  // Storage Keys
  // ---------------------------------------------------------------------------
  storage: {
    highScoreKey: 'intro_dino_high_score',
    mutedKey: 'intro_dino_audio_muted',
  }
};
