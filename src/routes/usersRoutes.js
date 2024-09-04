import { Router } from "express";
import passport from 'passport';
import nodemailer from 'nodemailer';


import config from "../config.js";
import UserController from "../controller/user.controller.js";
import { createToken ,createHash, verifyRequiredBody, isValidPassword, verifyMongoDBId } from "../services/utils.js";
import initAuthStrategies from '../auth/passport.strategies.js';
import { uploader } from '../services/uploader.js';

const controller = new UserController()
const router = Router()
initAuthStrategies();

const transport = nodemailer.createTransport({
    service: 'gmail',
    port: 587,
    auth: {
        user: config.GMAIL_APP_USER,
        pass: config.GMAIL_APP_PASS
    }
});

router.get("/", async (req, res) => {
    try {
        const users = await controller.get()

        res.status(200).send({ origin: config.SERVER, payload: users })
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.get("/:pid", async (req, res) => {
    try {
        const pid = req.params.pid
        const user = await controller.getById(pid)

        res.status(200).send({ origin: config.SERVER, payload: user })
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.put("/:pid", async (req, res) => {
    try {
        const filter = { _id: req.params.pid };
        const update = req.body;
        const options = { new: true };
        const user = await controller.update(filter, update, options);

        res.status(200).send({ origin: config.SERVER, payload: user });
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.delete("/:uid", async (req, res) => {
    try {
        const uid = { _id: req.params.uid }
        await controller.delete(uid);
        console.log(`usuario eliminado de la base de datos`);

        res.status(200).send({ origin: config.SERVER, payload: "eliminado" });
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.post("/restore",verifyRequiredBody(['email']), async (req,res) => {
    try {
        const email = req.body.email
        console.log(email);
        
        const exist = await controller.getByEmail(email)
        if (!exist) {return res.status(200).send({ origin: config.SERVER, payload: "el email no coincide con ningun usuario existente"})}

        console.log(`${config.UPLOAD_DIR}/prueba.png`)
        const token = createToken({email: email}, "10m")
        const confirmation = await transport.sendMail({
            from: `CoderStore <${config.GMAIL_APP_USER}>`, // email origen
            to: email,
            subject: 'Cambio de contraseña',
            html: `<h1>Realice un cambio de contraseña en el siguiente link</h1>
                 <a href="http://localhost:8080/restorePassword?access_token=${token}">link del token</a>
                 <p>El link para el cambio de coontraseña expirara en 15 minutos, en caso de no haber solicitado ignore el mensaje.</br>
                 NO COMPARTA EL ENLACE CON NADIE</p>`
            // attachments:[{
            //     filename:"prueba.png",
            //     path: `${config.UPLOAD_DIR}/prueba.png`,
            //     cid: "AYUDARTE Y YAA???"
            // }]
        });
        
        return res.status(200).send({ status: 'OK', data: {message: "ingrese a su mail para continuar con el cambio de contraseña", confirmation}})
    } catch (error) {
        res.status(500).send({ origin: config.SERVER, payload: null })
    }
})

router.post("/restorePassword",verifyRequiredBody(['password', "passwordConfirm", "email"]), async (req,res) =>{
    if (req.body.password != req.body.passwordConfirm){
        return res.status(500).send({ origin: config.SERVER, payload: "la nueva contraseña y la confirmacion de la nueva contraseña son diferentes, procure ingresar 2 veces la misma contraseña" })
    }
    
    const passwordHash = await controller.getByEmail(req.body.email)
    console.log(`passwordHash: ${passwordHash}`);
    

    if (isValidPassword(req.body.password, passwordHash.password)) {
        return res.status(500).send({ origin: config.SERVER, payload: "la nueva contraseña no puede ser igual a su contraseña actual" })
    }

    const filter = {email:req.body.email}
    const update = {password: createHash(req.body.password)}

    await controller.updateOne(filter, update)

    return res.status(200).send({ status: 'OK', data: "se cambio la contraseña correctamente"})
})

router.post("/:uid/documents",uploader.array('documentImages', 1) ,async (req,res) => {
    const typeDocument = req.body.optionDocument
    let pathFile 

    req.files.forEach(e => { pathFile = e.path})

    const filter = {_id: req.session.user._id}
    const data = {name: typeDocument, reference: pathFile}

    await controller.updateDocuments(filter, data)

return res.status(200).send({ status: 'OK', data: req.files, typeDocument})
}) 

router.post("/:uid/profiles",uploader.array('profileImages', 1) ,async (req,res) => {
return res.status(200).send({ status: 'OK', message: "imagen guardada en la carpeta profiles" ,data: req.files})
})

router.get("/premium/:uid", async (req, res) => {
    if(!req.session.user){
        return res.redirect("/login")
    }
    // console.log(req.session.user);
    const filter = { _id: req.params.uid };

    if (req.session.user.role == "admin") {
        return res.status(200).send({ origin: config.SERVER, payload: "usted es admin no deberia cambiar a user o premium" })
    }
    if (req.session.user.role == "user") {
        const user = await controller.getById(req.params.uid)
        
        if (user[0].documents) {
            let verifyDocument = false
            user[0].documents.forEach(e => {
               if (e.name == "Comprobante de estado de cuenta" ||  e.name == "Comprobante de domicilio" ||  e.name == "Identificación") {
                verifyDocument = true
               }  
            })
            if (!verifyDocument) {
                return res.status(200).send({ origin: config.SERVER, payload: "el usuario no tiene documentacion necesaria" })
            }
        } else {
            return res.status(200).send({ origin: config.SERVER, payload: "el usuario no tiene ningun tipo de documentacion" })
        }   
    }

    let update = {}
    const options = { new: true }
    req.session.user.role == "user" ? update = { role: "premium" } : update = { role: "user" }
    const user = await controller.updateOne(filter, update, options)
    req.session.user.role = update.role
    return res.status(200).send({ origin: config.SERVER, payload: `${req.session.user.firstName} ${req.session.user.lastName} ahora es: ${req.session.user.role}` })

})

export default router