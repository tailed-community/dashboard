import express from "express";
import { db } from "../lib/firebase";

const router = express.Router();

// NOTE: /profiles
router.put("/", async (request, response) => {
  const document = await db
    .collection("profiles")
    .where("profileId", "==", request.body.profileId)
    .get();

  // If the document doesnt exist, create it
  if (document.empty) {
    const doc = db.collection("profiles").add(request.body);
    response.status(200).json(doc);
  } else {
    // If a profile with this id alredy exists, return 400
    response
      .status(400)
      .send({ error: "A profile with this id already exists" });
  }
});

// NOTE: /profiles/{id}
router.get("/:id", async (request, response) => {
  // We get the document that contains the profileId
  const document = await db
    .collection("profiles")
    .where("profileId", "==", request.params.id)
    .get();

  // If there is no such user, return an error
  if (document.empty) {
    response.status(500).json({ error: "Document does not exist" });
    return;
  }

  // We assume that only one document will be returned since id
  // is unique
  document.forEach((doc) => {
    response.status(200).json(doc.data());
    return;
  });
});

// NOTE: /profiles/{id}
router.patch("/:id", async (request, response) => {
  const document = await db
    .collection("profiles")
    .where("profileId", "==", request.params.id)
    .get();

  // First check if the document we want to update exists
  if (document.empty) {
    response.status(404).json({ error: "Document does not exist" });
    return;
  }

  // If it exists, we can assume there will only be one document since the id is unique
  document.forEach((doc) => {
    // Update the document
    const promise = db.collection("profiles").doc(doc.id).update(request.body);
    promise.then(() => {
      response.sendStatus(200);
      return;
    });
  });
});

// NOTE: /profiles/{id}
router.delete("/:id", async (request, response) => {
  // Delete a company with the matching id
  const document = await db
    .collection("profiles")
    .where("profileId", "==", request.params.id)
    .get();

  // First check if the document exists
  if (document.empty) {
    // If not, return 400
    response.status(400).json({ error: "Document does not exist" });
    return;
  }

  document.forEach((doc) => {
    // Delete document
    const promise = db.collection("profiles").doc(doc.id).delete();
    promise.then(() => {
      response.sendStatus(200);
      return;
    });
  });
});

export default router;
