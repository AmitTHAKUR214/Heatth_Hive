import express from "express";
import { verifyUser } from "../middleware/auth.js";
import * as comment from "../controllers/commentController.js";

const router = express.Router();

router.post  ("/",                         verifyUser, comment.postComment);
router.post  ("/reply",                    verifyUser, comment.postReply);
router.post  ("/:id/interact",             verifyUser, comment.interactComment);
router.get   ("/user/:username",                       comment.getUserComments);
router.get   ("/:contentType/:contentId",              comment.getComments);
router.delete("/:id",                      verifyUser, comment.deleteComment);
router.put   ("/:commentId",               verifyUser, comment.editComment);

export default router;