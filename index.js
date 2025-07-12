const express = require("express")
const cors = require("cors")
const { MongoClient, ServerApiVersion } = require("mongodb")
require("dotenv").config()

const app = express()
const port = process.env.PORT || 3000

// Middleware
app.use(cors())
app.use(express.json())

// MongoDB connection
const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})

async function run() {
  try {
    const db = client.db("freshCart")
    const usersCollection = db.collection("users")

    // Test route
    app.get("/products", async (req, res) => {
      const products = await productsCollection.find().toArray()
      res.send(products)
    })

    console.log("✅ MongoDB Connected")
  } catch (err) {
    console.error(err)
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("FreshCart server is running 🥦")
})

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})
