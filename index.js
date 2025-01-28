const express = require('express')
const app = express();
const cors = require('cors')
const jwt = require('jsonwebtoken');
require('dotenv').config()
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
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
        // await client.connect();
        const medicine = client.db("MediBuyersDB").collection("meidicine")
        const cart = client.db("MediBuyersDB").collection("carts")
        const users = client.db("MediBuyersDB").collection("users")
        const allCategory = client.db("MediBuyersDB").collection("category")
        const payments = client.db("MediBuyersDB").collection("payments")
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
        app.post('/medicine', async (req, res) => {
            const item = req.body;
            const result = medicine.insertOne(item);
            res.send(result)
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
                // console.error(error);
                res.status(500).send("Error retrieving data");
            }
        });

        app.get('/allcategory', async (req, res) => {
            const result = await allCategory.find().toArray();
            res.send(result);
        })
        app.post('/allcategory', async (req, res) => {
            const { categoryName, categoryImage } = req.body;

            if (!categoryName || !categoryImage) {
                return res.status(400).json({ error: 'Both category name and image URL are required' });
            }

            const newCategory = { categoryName, categoryImage };

            try {
                const result = await allCategory.insertOne(newCategory);
                res.status(201).json({
                    message: 'Category added successfully',
                    category: result.ops[0]  // Send the added category data
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to add category' });
            }
        });

        // PUT - Update Category
        app.put('/allcategory/:id', async (req, res) => {
            const { categoryName, categoryImage } = req.body;

            if (!categoryName || !categoryImage) {
                return res.status(400).json({ error: 'Both category name and image URL are required' });
            }

            const updatedCategory = { categoryName, categoryImage };

            try {
                const result = await allCategory.updateOne(
                    { _id: new ObjectId(req.params.id) }, // Find category by ID
                    { $set: updatedCategory } // Update category fields
                );

                if (result.matchedCount === 0) {
                    return res.status(404).json({ error: 'Category not found' });
                }

                res.status(200).json({
                    message: 'Category updated successfully',
                    updatedCategory: { ...updatedCategory, _id: req.params.id } // Send updated category data
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to update category' });
            }
        });

        // DELETE - Delete a Category
        app.delete('/allcategory/:id', async (req, res) => {
            try {
                const result = await allCategory.deleteOne({ _id: new ObjectId(req.params.id) });

                if (result.deletedCount === 0) {
                    return res.status(404).json({ error: 'Category not found' });
                }

                res.status(200).json({
                    message: 'Category deleted successfully',
                    deletedId: req.params.id
                });
            } catch (err) {
                console.error(err);
                res.status(500).json({ error: 'Failed to delete category' });
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
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await users.findOne(query)
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden success' });
            }
            next();
        }
        const verifySeller = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await users.findOne(query)
            const isSeller = user?.role === 'seller';
            if (!isSeller) {
                return res.status(403).send({ message: 'forbidden success' });
            }
            next();
        }

        //users collection
        app.get('/medicine/:email', async (req, res) => {
            const { email } = req.params;
            const result = await medicine.find({ email: email }).toArray();
            res.send(result);
        });

        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
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
        // Backend Route to check if the user is a seller
        app.get('/users/seller/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.decoded.email) {  // Ensure the email matches the decoded JWT email
                return res.status(403).send({ message: 'Unauthorized access' });
            }
            const query = { email: email };
            console.log(query)
            const user = await users.findOne(query); 
            let seller = false;

            if (user) {
                seller = user.role === 'seller';
            }
            res.send({ seller });  // Return the seller status
        });


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
        //payment intent

        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;

            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: price, // example price value
                    currency: 'usd',
                    payment_method_types: ['card'], // Correct parameter
                });

                res.send({ clientSecret: paymentIntent.client_secret });
            } catch (error) {
                // console.error(error);
                res.status(400).send({ error: error.message });
            }
        });
        app.post('/payments', async (req, res) => {
            try {
                const payment = req.body;

                // Insert payment into the database
                const paymentResult = await payments.insertOne(payment);

                // Delete the cart item
                const query = { _id: new ObjectId(payment.cartId) }; // Make sure it's a valid ObjectId
                const deleteResult = await cart.deleteOne(query);

                res.send({ paymentResult, deleteResult });
            } catch (error) {
                console.error('Error processing payment or deleting cart:', error);
                res.status(500).send({ error: 'An error occurred while processing your payment.' });
            }
        });
        app.get('/payments', async (req, res) => {
            const result = await payments.find().toArray();
            res.send(result);
        })
        app.get('/payments/:email', async (req, res) => {
            const { email } = req.params;
            const result = await payments.find({ buyerEmail: email }).toArray();
            res.send(result);
        })
        app.get('/paymentsseller/:email', async (req, res) => {
            const { email } = req.params;
            const result = await payments.find({ buyerEmail: email }).toArray();
            res.send(result);
        })
        app.put('/payment/admin/:id', async (req, res) => {
            const { id } = req.params; // Extract the payment ID from the URL
            const { status } = req.body; // Extract the new status from the request body

            // Validate the status (it should be either 'pending' or 'paid')
            if (!['pending', 'paid'].includes(status)) {
                return res.status(400).json({ message: 'Invalid status value. Must be "pending" or "paid".' });
            }

            try {
                // Update payment status
                const result = await payments.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: { status } }
                );

                if (result.modifiedCount === 0) {
                    return res.status(404).send({ message: 'Payment not found or status is already set to the same value' });
                }

                // Send the success response
                res.send({ message: 'Payment status updated successfully' });
            } catch (error) {
                console.error(error);
                res.status(500).json({ message: 'Error updating payment status' });
            }
        });


        // Send a ping to confirm a successful connection
    //     await client.db("admin").command({ ping: 1 });
    //     console.log("Pinged your deployment. You successfully connected to MongoDB!");
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