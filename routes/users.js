var express = require("express");
var router = express.Router();
var User = require("../models/user");
var middleware = require("../middleware");
var Campground = require("../models/campground");
var multer = require("multer");
var storage = multer.diskStorage({
  filename: function(req, file, callback) {
    callback(null, Date.now() + file.originalname);
  }
});
var imageFilter = function(req, file, cb) {
  // accept image files only
  if (!file.originalname.match(/\.(jpg|jpeg|png|gif)$/i)) {
    return cb(new Error("Only image files are allowed!"), false);
  }
  cb(null, true);
};
var upload = multer({ storage: storage, fileFilter: imageFilter });

var cloudinary = require("cloudinary");
cloudinary.config({
  cloud_name: "contrecc",
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// SHOW USER PAGE
router.get("/:id", function(req, res) {
  User.findById(req.params.id, function(err, foundUser) {
    if (err || !foundUser) {
      req.flash("error", "Something went wrong. No user found.");
      return res.redirect("/");
    }
    Campground.find()
      .where("author.id")
      .equals(foundUser._id)
      .exec(function(err, campgrounds) {
        if (err) {
          req.flash("error", "Something went wrong.");
          return res.redirect("/");
        }
        res.render("users/show", {
          user: foundUser,
          campgrounds: campgrounds,
          page: "profile"
        });
      });
  });
});

// EDIT USER PAGE
router.get("/:id/edit", middleware.isLoggedIn, function(req, res) {
  User.findById(req.params.id, function(err, foundUser) {
    if (err) {
      req.flash("error", "No user found");
      return res.redirect("back");
    }
    res.render("users/edit", { user: foundUser });
  });
});

// UPDATE USER PAGE
router.put(
  "/:id",
  middleware.checkUserOwnership,
  upload.single("avatar"),
  function(req, res) {
    var newData = {
      email: req.body.email,
      bio: req.body.bio,
      avatar: req.body.avatar
    };

    User.findById(req.params.id, async function(err, user) {
      if (err) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      if (req.file) {
        try {
          if (user.avatarId) {
            await cloudinary.v2.uploader.destroy(user.avatarId);
          }
          let result = await cloudinary.v2.uploader.upload(req.file.path);
          user.avatarId = result.public_id;
          user.avatar = result.secure_url;
        } catch (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
      }
      user.email = req.body.email;
      user.bio = req.body.bio;
      user.save();
      req.flash("success", "You successfully updated your profile!");
      res.redirect("/users/" + user._id);
    });
  }
);

module.exports = router;
