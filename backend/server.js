const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth2').Strategy;
const jwt = require('jsonwebtoken');
const mysql = require('mysql2/promise');
const session = require('express-session');

// const crypto = require('crypto');

// const generateSessionSecret = () => {
//   return crypto.randomBytes(32).toString('hex');
// };

// const sessionSecret = generateSessionSecret();
// console.log(sessionSecret);


const app = express();

// Load environment variables from .env file
dotenv.config();

// Middleware
app.use(cors());
app.use(express.json());
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
  }));
app.use(passport.initialize());
app.use(passport.session());

// Database Connection
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Passport.js Configuration
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: '/auth/google/callback',
    },
    async (accessToken, refreshToken, profile, done) => {
      // Google authentication callback logic
      try {
        // Check if the user already exists in the database
        const [existingUser] = await connection.execute('SELECT * FROM users WHERE google_id = ?', [profile.id]);

        if (existingUser.length > 0) {
          // User already exists, pass the user data to the callback
          done(null, existingUser[0]);
        } else {
          // User doesn't exist, store the Google authentication details in the database
          await connection.execute('INSERT INTO users (google_id, email) VALUES (?, ?)', [profile.id, profile.email]);

          // Retrieve the newly created user from the database and pass the user data to the callback
          const [newUser] = await connection.execute('SELECT * FROM users WHERE google_id = ?', [profile.id]);
          done(null, newUser[0]);
        }
      } catch (error) {
        console.error(error);
        done(error);
      }
    }
  )
);

// Serialize user into a session
passport.serializeUser((user, done) => {
  done(null, user);
});

// Deserialize user from a session
passport.deserializeUser((user, done) => {
  done(null, user);
});

// Google authentication route
app.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

// Callback route after successful Google authentication
app.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: '/login' }), (req, res) => {
  // Generate a bearer token for the user
  const token = generateToken(req.user.email);
  // Return the token or redirect to a page with the token
//   res.redirect(`/authenticated?token=${token}`);
  res.redirect(`${process.env.FRONTEND_URL}/?token=${token}`);

});

// Login with email and password route
app.post('/auth/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Query the database to check if email and password are valid
    const [rows] = await connection.execute('SELECT * FROM users WHERE email = ? AND password = ?', [email, password]);

    if (rows.length > 0) {
      const user = rows[0];
      // Generate a bearer token for the user
      const token = generateToken(user.email);
      res.json({ token });
    } else {
      res.status(401).json({ message: 'Invalid email or password' });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

// Signup with email and password route
app.post('/auth/signup', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user already exists in the database
    const [existingUser] = await connection.execute('SELECT * FROM users WHERE email = ?', [email]);

    if (existingUser.length > 0) {
      // User already exists, update the password
      await connection.execute('UPDATE users SET password = ? WHERE email = ?', [password, email]);

      // Generate a token
      const token = generateToken(email);
      res.json({ token });
    } else {
      // User doesn't exist, create a new user in the database
      await connection.execute('INSERT INTO users (email, password) VALUES (?, ?)', [email, password]);

      // Generate a token
      const token = generateToken(email);
      res.json({ token });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal Server Error' });
  }
});

app.get('/authenticated', (req, res) => {
// Extract the token from the query parameter
const token = req.query.token;

// Verify the token and handle authentication
try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Handle authentication success
    res.json({ message: 'Authentication successful!', email: decoded.email });
} catch (error) {
    console.error(error);
    // Handle authentication failure
    res.status(401).json({ message: 'Authentication failed!' });
}
});

// Function to generate JWT token
function generateToken(email) {
  const token = jwt.sign({ email }, process.env.JWT_SECRET, { expiresIn: '1h' });
  return token;
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start the server
const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
