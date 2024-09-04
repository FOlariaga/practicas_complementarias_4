import { Router } from "express";
import config from "../config.js";
import { uploader } from '../services/uploader.js';
import ProductController from "../controller/product.controller.js";
import { authorizationRole, verifyMongoDBId } from "../services/utils.js";
// import productsModel from "../dao/models/products.model.js"

const controller = new ProductController()
const router = Router()


router.get("/", async (req, res) => {
    try {
        const products = await controller.get({ limit: req.query.limit || 10, page: req.query.page || 1, query: req.query.query || "" })
        res.status(200).send({ origin: config.SERVER, payload: products })


    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.get("/:pid", async (req, res) => {
    try {
        const pid = req.params.pid
        const product = await controller.getById(pid)
        console.log(product);

        res.status(200).send({ origin: config.SERVER, payload: product })
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

// router.post("/",authorizationRole(["admin", "premium"]), uploader.single('thumbnails'), async (req, res) => {
router.post("/products", authorizationRole(["admin", "premium"]), uploader.array('productImages', 3), async (req, res) => {
    try {
        let owner = req.session.user._id

        // if (req.session.user.role == "premium") {
        //     owner = req.session.user._id
        // }
        // console.log({ ...req.body, owner });
        // console.log(owner);

        if (req.files) {
            const filenames = []
            req.files.forEach(e => {filenames.push(e.filename)})
            
            const thumbnail = { thumbnail: filenames || "" }
            
            const data = { ...req.body, ...thumbnail, owner }
            const process = await controller.add(data)
            res.status(201).send({ origin: config.SERVER,message: "producto agregado", payload: process });
        } else {
            const process = await controller.add({ ...req.body, owner })
            // console.log(`este es el process: ${process}`)
            res.status(201).send({ origin: config.SERVER,message: "producto agregado", payload: process });
        }

    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.put("/:pid", async (req, res) => {
    try {
        const filter = { _id: req.params.pid };
        const update = req.body;
        const options = { new: true };
        const process = await controller.update(filter, update, options);

        res.status(200).send({ origin: config.SERVER, payload: process });
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})


    // router.delete("/:id", async (req, res) => {
    router.delete("/:id", authorizationRole(["admin","premium"]), async (req, res) => {
    try {
        
        if (req.session.user.role == "admin") {
            const pid = { _id: req.params.id }
            await controller.delete(pid);
            console.log(`producto eliminado de la base de datos`);
            
            return res.status(200).send({ origin: config.SERVER, payload: "eliminado" });
        }
        if (req.session.user.role == "premium") {
            const product = await controller.getById(req.params.id)
            
            if (req.session.user._id == product.owner) {
                console.log("este producto pertenece al usuario premium");
                const pid = { _id: product._id }
                await controller.delete(pid);
                
                return res.status(200).send({ origin: config.SERVER, payload: product })
                
            } else {
                return res.status(200).send({ origin: config.SERVER, payload: "un premium solo puede eliminar productos que le pertenecen" })
            }
        }

    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

export default router