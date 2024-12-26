const express = require("express");
const { google } = require("googleapis");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient(); // Prisma client for database
dotenv.config();

const app = express();
const port = 3000;

// Middleware
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// OAuth2 Configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.CLIENT_ID,
  process.env.CLIENT_SECRET,
  process.env.REDIRECT_URI
);

// Scopes for accessing Google Calendar
const SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
];

// Helper: Set Credentials from Database
const setCredentialsFromDB = async (email) => {
  const user = await prisma.user.findUnique({ where: { email } });
  if (user) {
    oauth2Client.setCredentials({
      access_token: user.accessToken,
      refresh_token: user.refreshToken,
      expiry_date: user.expiryDate,
    });
  }
};

// Helper: Refresh Access Token
const refreshAccessToken = async (email) => {
  try {
    const { credentials } = await oauth2Client.refreshAccessToken();
    await prisma.user.update({
      where: { email },
      data: {
        accessToken: credentials.access_token,
        expiryDate: new Date(credentials.expiry_date).toISOString(),
      },
    });
    console.log("Access token refreshed for:", email);
  } catch (error) {
    console.error("Error refreshing access token:", error.message);
  }
};

// Routes
app.get("/", (req, res) => {
  res.send(`
    <h1>Google Calendar API Example</h1>
    <a href="/auth">Login with Google</a>
  `);
});

// Step 1: Redirect to Google's OAuth 2.0 Server
app.get("/auth", (req, res) => {
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent", // Always request new refresh tokens
  });
  res.redirect(url);
});

// Step 2: Handle the OAuth2 callback
app.get("/oauth2callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("Authorization code not provided.");
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    const email = "sherinsk007@gmail.com"; // Replace with dynamic user email
    await prisma.user.upsert({
      where: { email },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date).toISOString(),
      },
      create: {
        email,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date).toISOString(),
      },
    });

    res.send(`
      <h1>Login Successful</h1>
      <a href="/events">View Events</a><br/>
      <a href="/create-event">Create Event</a>
    `);
  } catch (error) {
    console.error("Error during OAuth callback:", error.message);
    res.status(500).send("Authentication failed.");
  }
});

// Step 3: Fetch and display events
app.get("/events", async (req, res) => {
  try {
    const email = "sherinsk007@gmail.com"; // Replace with dynamic user email
    await setCredentialsFromDB(email);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    const response = await calendar.events.list({
      calendarId: "primary",
      timeMin: new Date().toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = response.data.items;
    if (events.length) {
      res.send(
        `<h1>Upcoming Events</h1>` +
          events
            .map(
              (event) =>
                `<p>${event.summary} - ${event.start.dateTime || event.start.date}</p>`
            )
            .join("") +
          `<br/><a href="/">Go Back</a>`
      );
    } else {
      res.send("<h1>No upcoming events found.</h1><a href='/'>Go Back</a>");
    }
  } catch (error) {
    console.error("Error fetching events:", error);

    if (error.code === 401) {
      console.log("Refreshing token and retrying...");
      await refreshAccessToken("sherinsk007@gmail.com");
      return res.redirect("/events");
    }

    res.status(500).send("Failed to fetch events.");
  }
});

// Step 4: Create a new calendar event
app.get("/create-event", async (req, res) => {
  try {
    const email = "sherinsk007@gmail.com"; // Replace with dynamic user email
    await setCredentialsFromDB(email);

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const event = {
      summary: "Onam",
      location: "Somewhere nice!",
      description: "Celebrating Sherin's special day!",
      start: {
        dateTime: new Date("2025-01-05T09:00:00+05:30").toISOString(),
        timeZone: "Asia/Kolkata",
      },
      end: {
        dateTime: new Date("2025-01-05T12:00:00+05:30").toISOString(),
        timeZone: "Asia/Kolkata",
      },
      attendees: [{ email: "example@example.com" }],
    };

    const response = await calendar.events.insert({
      calendarId: "primary",
      resource: event,
    });

    res.send(
      `<h1>Event Created Successfully</h1>
       <p>Event ID: ${response.data.id}</p>
       <a href="/events">View Events</a>`
    );
  } catch (error) {
    console.error("Error creating event:", error);
    if (error.code === 401) {
      console.log("Refreshing token and retrying...");
      await refreshAccessToken("sherinsk007@gmail.com");
      return res.redirect("/create-event");
    }
    res.status(500).send("Failed to create event.");
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});


// const express = require("express");
// const { google } = require("googleapis");
// const dotenv = require("dotenv");
// const cookieParser = require("cookie-parser");

// dotenv.config();

// const app = express();
// const port = 3000;

// // Middleware
// app.use(cookieParser());
// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

// // OAuth2 Configuration
// const oauth2Client = new google.auth.OAuth2(
//   process.env.CLIENT_ID,
//   process.env.CLIENT_SECRET,
//   process.env.REDIRECT_URI
// );

// // Scopes for accessing Google Calendar
// const SCOPES = [
//   "https://www.googleapis.com/auth/calendar",
//   "https://www.googleapis.com/auth/calendar.events",
// ];

// // Routes
// app.get("/", (req, res) => {
//   res.send(`<h1>Google Calendar API Example</h1>
//             <a href="/auth">Login with Google</a>`);
// });

// // Step 1: Redirect to Google's OAuth 2.0 Server
// app.get("/auth", (req, res) => {
//   const url = oauth2Client.generateAuthUrl({
//     access_type: "offline",
//     scope: SCOPES,
//   });
//   res.redirect(url);
// });

// // Step 2: Handle the OAuth2 callback
// app.get("/oauth2callback", async (req, res) => {
//   const code = req.query.code;

//   if (!code) {
//     return res.status(400).send("Authorization code not provided.");
//   }

//   try {
//     const { tokens } = await oauth2Client.getToken(code);
//     oauth2Client.setCredentials(tokens);

//     // Save tokens in a cookie (optional)
//     res.cookie("access_token", tokens.access_token, { httpOnly: true });

//     res.send(`
//       <h1>Login Successful</h1>
//       <a href="/events">View Events</a><br/>
//       <a href="/create-event">Create Event</a>
//     `);
//   } catch (error) {
//     console.error("Error during OAuth callback:", error);
//     res.status(500).send("Authentication failed.");
//   }
// });

// // Step 3: Fetch and display events
// app.get("/events", async (req, res) => {
//   try {
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });
//     const response = await calendar.events.list({
//       calendarId: "primary",
//       timeMin: new Date().toISOString(),
//       singleEvents: true,
//       orderBy: "startTime",
//     });

//     const events = response.data.items;
//     if (events.length) {
//       res.send(
//         `<h1>Upcoming Events</h1>` +
//           events
//             .map(
//               (event) =>
//                 `<p>${event.summary} - ${event.start.dateTime || event.start.date}</p>`
//             )
//             .join("") +
//           `<br/><a href="/">Go Back</a>`
//       );
//     } else {
//       res.send("<h1>No upcoming events found.</h1><a href='/'>Go Back</a>");
//     }
//   } catch (error) {
//     console.error("Error fetching events:", error);
//     res.status(500).send("Failed to fetch events.");
//   }
// });

// // Step 4: Create a new calendar event
// app.get("/create-event", async (req, res) => {
//   try {
//     const calendar = google.calendar({ version: "v3", auth: oauth2Client });

//     const event = {
//         summary: "Sherin's Birthday",
//         location: "Somewhere nice!",
//         description: "Celebrating Sherin's special day!",
//         start: {
//           dateTime: new Date("2025-01-02T09:00:00+05:30").toISOString(), // January 2, 2025 at 9:00 AM IST
//           timeZone: "Asia/Kolkata",
//         },
//         end: {
//           dateTime: new Date("2025-01-02T12:00:00+05:30").toISOString(), // January 2, 2025 at 12:00 PM IST
//           timeZone: "Asia/Kolkata",
//         },
//         attendees: [{ email: "example@example.com" }], // You can add Sherin's email or other attendees here
//       }

//     const response = await calendar.events.insert({
//       calendarId: "primary",
//       resource: event,
//     });

//     res.send(
//       `<h1>Event Created Successfully</h1>
//        <p>Event ID: ${response.data.id}</p>
//        <a href="/events">View Events</a>`
//     );
//   } catch (error) {
//     console.error("Error creating event:", error);
//     res.status(500).send("Failed to create event.");
//   }
// });

// // Step 5: Delete a calendar event by ID
// app.get("/delete-event/:eventId", async (req, res) => {
//     const eventId = req.params.eventId;
  
//     if (!eventId) {
//       return res.status(400).send("Event ID is required to delete an event.");
//     }
  
//     try {
//       const calendar = google.calendar({ version: "v3", auth: oauth2Client });
  
//       await calendar.events.delete({
//         calendarId: "primary",
//         eventId: eventId,
//       });
  
//       res.send(`
//         <h1>Event Deleted Successfully</h1>
//         <a href="/events">View Events</a>
//       `);
//     } catch (error) {
//       console.error("Error deleting event:", error);
//       res.status(500).send("Failed to delete event.");
//     }
//   });

// app.listen(port, () => {
//   console.log(`Server running on http://localhost:${port}`);
// });
