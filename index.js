const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.cgep2.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const medicine = client.db("MediBuyersDB").collection("meidicine")
        const cart = client.db("MediBuyersDB").collection("carts")
        const users = client.db("MediBuyersDB").collection("users")
        //jwt related
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '5h'
            })
            res.send({ token })
        })
        //medicine related
        app.get('/medicine', async (req, res) => {
            const result = await medicine.find().toArray();
            // console.log(result)
            res.send(result);
        })

        app.get('/medicine-data', async (req, res) => {
            const result = await medicine.find({ discount: { $exists: true } }).toArray();
            res.send(result);
        })

        app.get('/category/:category', async (req, res) => {
            const category = req.params.category;

            try {
                // Case-insensitive search using a regular expression
                const result = await medicine.find({ category: { $regex: new RegExp(category, 'i') } }).toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send("Error retrieving data");
            }
        });

        // middleware
        const verifyToken = (req, res, next) => {
            console.log('inside verify token', req.headers);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'forbidden success' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'forbidden success' });
                }
                req.decoded = decoded;
                next();
            })
        }
        const verifyAdmin = async(req,res,next)=>{
            const email = req.decoded.email;
            const query = {email: email}
            const user = await users.findOne(query)
            const isAdmin = user?.role === 'admin';
            if(!isAdmin){
                return res.status(403).send({ message: 'forbidden success' });
            }
            next();
        }

        //users collection
        app.get('/users', verifyToken,verifyAdmin, async (req, res) => {
            console.log(req.headers);
            const result = await users.find().toArray();
            res.send(result)
        })
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'unauthorized access' })
            }
            const query = { email: email };
            const user = await users.findOne(query);
            let admin = false;
            if (user) {
                admin = user.role === 'admin';
            }
            res.send({ admin })
        })
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await users.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await users.insertOne(user);
            res.send(result);
        })
        app.put('/update-user/:id', async (req, res) => {
            const { id } = req.params;
            const { role } = req.body;

            try {
                const result = await users.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { role } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Cart item not found' });
                }

                res.send({ message: 'Cart item updated successfully' });
            } catch (error) {
                res.status(500).send({ message: 'Error updating cart item' });
            }
        });

        //carts collection
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const result = await cart.find(query).toArray();
            res.send(result);
        })
        app.post('/carts', async (req, res) => {
            const cartItem = req.body;
            const result = await cart.insertOne(cartItem);
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cart.deleteOne(query);
            res.send(result)
        })

        app.put('/update-cart/:id', async (req, res) => {
            const { id } = req.params;
            const { quantity } = req.body;

            if (!quantity || quantity <= 0) {
                return res.status(400).send({ message: 'Invalid quantity' });
            }

            try {
                const result = await cart.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { quantity } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Cart item not found' });
                }

                res.send({ message: 'Cart item updated successfully' });
            } catch (error) {
                res.status(500).send({ message: 'Error updating cart item' });
            }
        });


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('MediBuyers');
})

app.listen(port, () => {
    console.log(`app is running at http://localhost:${port}`)
})