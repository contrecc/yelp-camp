var express = require("express");
var router = express.Router();
var passport = require("passport");
var User = require("../models/user");
var Campground = require("../models/campground");
var middleware = require("../middleware");
var async = require("async");
var nodemailer = require("nodemailer");
var crypto = require("crypto");

// Root Route
router.get("/", function(req, res) {
  res.render("landing", { page: "landing" });
});

// =====================
// AUTH ROUTES
// =====================

// show register form
router.get("/register", function(req, res) {
  res.render("register", { page: "register" });
});

// handle sign up logic
router.post("/register", function(req, res) {
  var newUser = new User({
    username: req.body.username,
    email: req.body.email
  });
  // check if the user has entered the correct adminCode
  if (req.body.adminCode === process.env.ADMIN_CODE) {
    newUser.isAdmin = true;
  }
  User.register(newUser, req.body.password, function(err, user) {
    if (err) {
      req.flash("error", err.message);
      return res.render("register");
    }
    passport.authenticate("local")(req, res, function() {
      req.flash("success", "Welcome to YelpCamp, " + user.username);
      res.redirect("/campgrounds");
    });
  });
});

// SHOW LOGIN FORM
router.get("/login", function(req, res) {
  res.render("login", { page: "login" });
});

// HANDLE LOGIN LOGIC
router.post(
  "/login",
  passport.authenticate("local", {
    successRedirect: "/campgrounds",
    failureRedirect: "/login",
    successFlash: "You've logged in!",
    failureFlash: true
  }),
  function(req, res) {}
);

// LOGOUT ROUTE
router.get("/logout", function(req, res) {
  req.logout();
  req.flash("success", "Logged you out!");
  res.redirect("/campgrounds");
});

// FORGOT PASSWORD GET ROUTE
router.get("/forgot", function(req, res) {
  res.render("forgot");
});

// FORGOT PASSWORD POST ROUTE
router.post("/forgot", function(req, res, next) {
  async.waterfall(
    [
      function(done) {
        crypto.randomBytes(20, function(err, buf) {
          var token = buf.toString("hex");
          done(err, token);
        });
      },
      function(token, done) {
        User.findOne({ email: req.body.email }, function(err, user) {
          if (err || !user) {
            req.flash("error", "No account with that email address exists.");
            return res.redirect("/forgot");
          }

          user.resetPasswordToken = token;
          user.resetPasswordExpires = Date.now() + 3600000; // 1 hour

          user.save(function(err) {
            done(err, token, user);
          });
        });
      },
      function(token, user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: "colincontrearycoder@gmail.com",
            pass: process.env.GMAILPW
          },
          tls: {
            rejectUnauthorized: false
          }
        });
        var mailOptions = {
          to: user.email,
          from: "colincontrearycoder@gmail.com",
          subject: "Node.js Password Reset",
          text:
            "You are receiving this because you (or someone else) has requested the reset of the password for YelpCamp" +
            "\n\n" +
            "Please click on the following link, or paste this into your browser to complete the process." +
            "\n\n" +
            "http://" +
            req.headers.host +
            "/reset/" +
            token +
            "\n\n" +
            "If you did not request this, please ignore this email and your password will remain unchanged."
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          console.log("mail sent");
          req.flash(
            "success",
            "An email has been sent to " +
              user.email +
              " with further instructions."
          );
          done(err, "done");
        });
      }
    ],
    function(err) {
      if (err) {
        return next(err);
      }
      res.redirect("/forgot");
    }
  );
});

// RESET PAGE GET ROUTE
router.get("/reset/:token", function(req, res) {
  User.findOne(
    {
      resetPasswordToken: req.params.token,
      resetPasswordExpires: { $gt: Date.now() }
    },
    function(err, user) {
      if (err || !user) {
        req.flash("error", "Password reset token is invalid or has expired.");
        return res.redirect("/forgot");
      }
      res.render("reset", { token: req.params.token });
    }
  );
});

// RESET PAGE POST ROUTE
router.post("/reset/:token", function(req, res) {
  async.waterfall(
    [
      function(done) {
        User.findOne(
          {
            resetPasswordToken: req.params.token,
            resetPasswordExpires: { $gt: Date.now() }
          },
          function(err, user) {
            if (err) {
              req.flash("error", err.message);
              return res.redirect("back");
            }

            if (!user) {
              req.flash(
                "error",
                "Password reset token is invalid or has expired."
              );
              return res.redirect("back");
            }
            if (req.body.password === req.body.confirm) {
              user.setPassword(req.body.password, function(err) {
                if (err) {
                  req.flash("error", err.message);
                  return res.redirect("back");
                }

                user.resetPasswordToken = undefined;
                user.resetPasswordExpires = undefined;

                user.save(function(err) {
                  done(err, user);
                });
              });
            } else {
              req.flash("error", "Passwords do not match");
              return res.redirect("back");
            }
          }
        );
      },
      function(user, done) {
        var smtpTransport = nodemailer.createTransport({
          service: "Gmail",
          auth: {
            user: "colincontrearycoder@gmail.com",
            pass: process.env.GMAILPW
          }
        });
        var mailOptions = {
          to: user.email,
          from: "colincontrearycoder@gmail.com",
          subject: "Your password has been changed",
          text:
            "Hello,\n\n" +
            "This is a confirmation that the password for your account " +
            user.email +
            " has just been changed.\n"
        };
        smtpTransport.sendMail(mailOptions, function(err) {
          req.flash("success", "Success! Your password has been changed.");
          done(err);
        });
      }
    ],
    function(err) {
      if (err) {
        req.flash(
          "error",
          "An error when sending you a changed password email."
        );
        res.redirect("back");
      }
      res.redirect("/campgrounds");
    }
  );
});

module.exports = router;
