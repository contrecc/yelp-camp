var Campground = require("../models/campground");
var Comment = require("../models/comment");
var User = require("../models/user");

// all the middleware goes here
var middlewareObj = {};

middlewareObj.checkCampgroundOwnership = function(req, res, next){
  if(req.isAuthenticated()){
    Campground.findById(req.params.id, function(err, foundCampground){
      if(err || !foundCampground) {
        req.flash("error", "Campground not found");
        res.redirect("back");
      } else if(foundCampground.author.id.equals(req.user._id) || req.user.isAdmin){
          req.campground = foundCampground;
          next();
      } else {
           req.flash("error", "You don't have permission to do that");
           res.redirect("/campgrounds/" + req.params.id);
      }
    });
  }
}

middlewareObj.checkCommentOwnership = function(req, res, next){
  if(req.isAuthenticated()){
    Comment.findById(req.params.comment_id, function(err, foundComment){
      if(err || !foundComment) {
        console.log(err);
        req.flash("error", "Comment not found");
        res.redirect("back");
      } else if(foundComment.author.id.equals(req.user._id) || req.user.isAdmin){
          req.comment = foundComment;
          next();
      } else {
           req.flash("error", "You don't have permission to do that");
           res.redirect("/campgrounds/" + req.params.id);
      }
    });
  }
}

middlewareObj.isLoggedIn = function(req, res, next){
  if(req.isAuthenticated()){
    return next();
  }
  req.flash("error", "You need to be logged in to do that");
  res.redirect("/login");
}

middlewareObj.checkUserOwnership = function(req, res, next){
  if(req.isAuthenticated()){
    User.findById(req.params.id, function(err, foundUser){
      if(err || !foundUser){
        console.log(err);
        req.flash("error", "User not found");
        return res.redirect("back");
      } else if(foundUser._id.equals(req.user._id) || req.user.isAdmin){
          next();
      } else {
        req.flash("error", "Only the user can edit their profile page");
        return res.redirect("back");
      }
      
      });
  }
}

module.exports = middlewareObj;