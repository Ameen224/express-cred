const fs = require("fs");
const express = require("express");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const { v4: uuidv4 } = require("uuid");

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data
app.use(cookieParser());
app.use(
    session({
        secret: "your-secret-key", // Replace with a secure key
        resave: false,
        saveUninitialized: true,
        cookie: { secure: false, maxAge: 60000 }, // Adjust `maxAge` as needed
    })
);
app.set("view engine", "ejs"); // Set EJS as the template engine

let form;
try {
    form = fs.readFileSync("./home.html", "utf-8");
} catch (error) {
    console.error("Error reading home.html:", error);
    form = "<h1>Home page not available</h1>";
}

// Load data from `data.json`
let storage;
try {
    storage = JSON.parse(fs.readFileSync("./data.json", "utf-8"));
    if (!Array.isArray(storage)) {
        storage = []; // Initialize as an empty array if the content is not an array
    }
} catch (error) {
    console.error("Error reading data.json:", error);
    storage = [];
}

// Routes
// Serve `home.html`
app.get("/home", (req, res) => {
    const lastSubmissionTime = req.cookies.lastSubmissionTime;
    const message = lastSubmissionTime
        ? `<p>Last submission time: ${lastSubmissionTime}</p>`
        : "";
    res.send(form + message);
});

// Handle form submission and add data to `data.json`
app.post("/post", (req, res) => {
    console.log("Received data:", req.body);
    const data = req.body;

    // Assign unique ID to the new data
    data.id = uuidv4();

    // Add new data to storage
    storage.push(data);

    // Store submitted data in the session
    if (!req.session.submittedData) {
        req.session.submittedData = [];
    }
    req.session.submittedData.push(data);

    
    // Set a cookie for the last submission time
    res.cookie("newdata", data,new Date().toISOString(), {
        maxAge: 900000, // 15 minutes
        httpOnly: true,
    });

    // Save updated storage to `data.json`
    fs.writeFile("./data.json", JSON.stringify(storage, null, 2), (err) => {
        if (err) {
            console.error("Error writing to data.json:", err);
            res.status(500).json({ message: "Internal Server Error" });
        } else {
            console.log("Data added successfully to data.json");
            res.redirect("/home");
        }
    });
});

// Render `table.ejs` with data from `data.json`
app.get("/table", (req, res) => {
    const sessionData = req.session.submittedData || [];
    res.render("table", { dataArray: sessionData.length ? sessionData : storage });
});

// Delete a record
app.delete("/delete/:id", (req, res) => {
    const deleteId = req.params.id;
    console.log("Request to delete ID:", deleteId);

    // Find the index of the item to delete
    const deleteIndex = storage.findIndex((item) => item.id === deleteId);

    if (deleteIndex === -1) {
        console.error("Item not found for ID:", deleteId);
        return res.status(404).json({ message: "Item not found" });
    }

    // Remove the item from the array
    storage.splice(deleteIndex, 1);

    // Save the updated data back to `data.json`
    fs.writeFile("./data.json", JSON.stringify(storage, null, 2), (err) => {
        if (err) {
            console.error("Error writing to data.json:", err);
            return res.status(500).json({ message: "Internal Server Error" });
        }
        console.log("Item deleted successfully:", deleteId);
        res.status(200).json({ message: "Item deleted successfully" });
    });
});

// Edit a record
app.get("/edit/:id", (req, res) => {
    const editId = req.params.id;
    console.log(editId);

    // Store the edit ID in the session
    req.session.lastEdited = editId;

    const editData = storage.find((item) => item.id === editId);

    if (editData) {
        res.render("edit.ejs", { data: editData });
    } else {
        res.status(404).send("Record not found");
    }
});

// Update a record
app.post("/update/:id", (req, res) => {
    const updateId = req.params.id;
    req.session.lastEdited = updateId;

    const updatedData = req.body;
    const index = storage.findIndex((item) => item.id === updateId);

    if (index !== -1) {
        storage[index] = { ...storage[index], ...updatedData };

        // Save the updated data to the JSON file
        fs.writeFile("./data.json", JSON.stringify(storage, null, 2), (err) => {
            if (err) {
                console.error("Error updating data.json:", err);
                res.status(500).send("Internal Server Error");
            } else {
                res.redirect("/table");
            }
        });
    } else {
        res.status(404).send("Record not found");
    }
});

// Clear session
app.get("/clear-session", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).send("Failed to clear session");
        }
        res.send("Session cleared");
    });
});

// Clear cookies
app.get("/clear-cookies", (req, res) => {
    res.clearCookie("lastSubmissionTime");
    res.send("Cookies cleared");
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}/home`);
});
