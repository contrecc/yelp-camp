var express = require("express");
var router = express.Router({mergeParams: true});
var Campground = require("../models/campground");
var Comment = require("../models/comment");
var middleware = require("../middleware");

// COMMENT NEW
router.get("/new", middleware.isLoggedIn, function(req, res){
  // find campground by id
  Campground.findById(req.params.id, function(err, campground){
    if(err || !campground){
      req.flash("error", "Campground not found");
      res.redirect("back");
    } else {
        res.render("comments/new", {campground: campground});
    }
  });
});

// COMMENT CREATE
router.post("/", middleware.isLoggedIn, function(req, res){
  //lookup campground using id
  Campground.findById(req.params.id, function(err, campground){
    if(err){
      console.log(err);
      res.redirect("/campgrounds");
    } else {
      //create new comment
      Comment.create(req.body.comment, function(err, comment){
        if(err){
          req.flash("error", "Something went wrong");
          console.log(err);
        } else {
          // add username and id to comment
          comment.author.id = req.user._id;
          comment.author.username = req.user.username;
          // save comment
          comment.save();
          campground.comments.push(comment);
          campground.save();
          console.log(comment);
           //redirect to campground show page
          req.flash("success", "Successfully added comment");
          res.redirect("/campgrounds/" + campground._id);
        }
      })
    }
  });
});

// COMMENT EDIT
router.get("/:comment_id/edit", middleware.checkCommentOwnership, function(req, res){
  Campground.findById(req.params.id, function(err, foundCampground){
    if(err || !foundCampground){
      req.flash("error", "No campground found");
      return res.redirect("back");
    }
    Comment.findById(req.params.comment_id, function(err, foundComment){
      if(err){
        res.redirect("back");
      } else {
          res.render("comments/edit", {campground_id: req.params.id, comment: foundComment});
        }
    });
  });
});

// COMMENT UPDATE
router.put("/:comment_id", middleware.checkCommentOwnership, function(req, res){
  Comment.findByIdAndUpdate(req.params.comment_id, req.body.comment, function(err, updatedComment){
    if(err){
      res.redirect("back");
    } else {
      res.redirect("/campgrounds/" + req.params.id);
    }
  });
});

// COMMENT DESTROY
router.delete("/:comment_id", middleware.checkCommentOwnership, function(req, res){
  // findById and remove
  Comment.findByIdAndRemove(req.params.comment_id, function(err){
    if(err){
      res.redirect("back");
    } else {
      req.flash("success", "Comment deleted");
      res.redirect("/campgrounds/" + req.params.id);
    }
  });
});

module.exports = router;