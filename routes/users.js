var express = require("express");
var router = express.Router();
var User = require("../models/user");
var middleware = require("../middleware");
var Campground = require("../models/campground");



// SHOW USER PAGE
router.get("/:id", function(req, res){
  User.findById(req.params.id, function(err, foundUser){
    if(err || !foundUser){
      req.flash("error", "Something went wrong.");
      return res.redirect("/");
    }
    Campground.find().where('author.id').equals(foundUser._id).exec(function(err, campgrounds){
      if(err){
      req.flash("error", "Something went wrong.");
      return res.redirect("/");
    }
    res.render("users/show", {user: foundUser, campgrounds: campgrounds, page: 'profile'});
    });
  });
});


// EDIT USER PAGE
router.get("/:id/edit", middleware.isLoggedIn, function(req, res){
  User.findById(req.params.id, function(err, foundUser){
    if(err){
      req.flash("error", "No user found");
      return res.redirect("back");
    }
    res.render("users/edit", {user: foundUser});
  });
});

// UPDATE USER PAGE
router.put("/:id", middleware.checkUserOwnership, function(req, res){
  var newData = {
    email: req.body.email,
    bio: req.body.bio,
    avatar: req.body.avatar
  };
  
  User.findByIdAndUpdate(req.params.id, newData, function(err, updatedUser){
    if(err){
      req.flash("error", "Profile unable to be updated");
      return res.redirect("back");
    }
    req.flash("success", "Profile updated!");
    
    return res.redirect("/users/" + updatedUser._id);
  });
  });

module.exports = router;