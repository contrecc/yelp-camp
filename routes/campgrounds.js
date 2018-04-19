var express = require("express");
var router = express.Router();
var Campground = require("../models/campground");
var middleware = require("../middleware");
var NodeGeocoder = require("node-geocoder");
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

var options = {
  provider: "google",
  httpAdapter: "https",
  apiKey: process.env.GEOCODER_API_KEY,
  formatter: null
};

var geocoder = NodeGeocoder(options);

//INDEX - show all campgrounds
router.get("/", function(req, res) {
  if (req.query.search) {
    const regex = new RegExp(escapeRegex(req.query.search), "gi");
    Campground.find({ name: regex }, function(err, searchResults) {
      if (err) {
        console.log(err);
      } else {
        if (searchResults.length === 0) {
          req.flash(
            "error",
            "Sorry, no campgrounds match your query. Please try again."
          );
          return res.redirect("/campgrounds");
        }
        res.render("campgrounds/index", {
          campgrounds: searchResults,
          page: "campgrounds"
        });
      }
    });
  } else {
    // Get all campgrounds from DB
    Campground.find({}, function(err, allCampgrounds) {
      if (err) {
        console.log(err);
      } else {
        res.render("campgrounds/index", {
          campgrounds: allCampgrounds,
          page: "campgrounds"
        });
      }
    });
  }
});

//CREATE - add new campground to database
router.post(
  "/",
  middleware.isLoggedIn,
  upload.single("campground[image]"),
  function(req, res) {
    geocoder.geocode(req.body.campground.location, function(err, data) {
      if (err || !data.length) {
        req.flash("error", err.message);
        return res.redirect("back");
      }
      cloudinary.v2.uploader.upload(req.file.path, function(err, result) {
        if (err) {
          req.flash("error", err.message);
          return res.redirect("back");
        }
        //add cloudinary url for the image to the campground object under image property
        req.body.campground.image = result.secure_url;
        //add image's public_id to campground object
        req.body.campground.imageId = result.public_id;
        // add author to campground
        req.body.campground.author = {
          id: req.user._id,
          username: req.user.username
        };
        req.body.campground.lat = data[0].latitude;
        req.body.campground.lng = data[0].longitude;
        req.body.campground.location = data[0].formattedAddress;

        Campground.create(req.body.campground, function(err, campground) {
          if (err) {
            req.flash("error", err.message);
            return res.redirect("back");
          }
          res.redirect("/campgrounds/" + campground.id);
        });
      });
    });
  }
);

//NEW - show form to create new campground
router.get("/new", middleware.isLoggedIn, function(req, res) {
  res.render("campgrounds/new");
});

//SHOW - shows more info about one campground
router.get("/:id", function(req, res) {
  //find the campground with provided id
  Campground.findById(req.params.id)
    .populate("comments")
    .exec(function(err, foundCampground) {
      if (err || !foundCampground) {
        console.log(err);
        req.flash("error", "Campground not found");
        res.redirect("/campgrounds");
      } else {
        console.log(foundCampground);
        //render show template with that campground
        res.render("campgrounds/show", { campground: foundCampground });
      }
    });
});

//EDIT CAMPGROUND ROUTE - edits info about one campground
router.get("/:id/edit", middleware.checkCampgroundOwnership, function(
  req,
  res
) {
  Campground.findById(req.params.id, function(err, foundCampground) {
    if (err) {
      req.flash("error", "Campground not found");
      res.redirect("back");
    }
    res.render("campgrounds/edit", { campground: foundCampground });
  });
});

//UPDATE CAMPGROUND ROUTE - edit sends form to update to finalize changes
router.put(
  "/:id",
  middleware.checkCampgroundOwnership,
  upload.single("campground[image]"),
  function(req, res) {
    geocoder.geocode(req.body.campground.location, function(err, data) {
      //Error Handling For Autocomplete API Requests
      //Error handling provided by google docs -https://developers.google.com/places/web-service/autocomplete
      if (err || data.status === "ZERO_RESULTS") {
        req.flash("error", "Invalid address, try typing a new address");
        return res.redirect("back");
      }
      //Error handling provided by google docs -https://developers.google.com/places/web-service/autocomplete
      if (err || data.status === "REQUEST_DENIED") {
        req.flash("error", "Something Is Wrong Your Request Was Denied");
        return res.redirect("back");
      }
      //Error handling provided by google docs -https://developers.google.com/places/web-service/autocomplete
      if (err || data.status === "OVER_QUERY_LIMIT") {
        req.flash("error", "All Requests Used Up");
        return res.redirect("back");
      }
      //Credit To Ian For Fixing The Geocode Problem - https://www.udemy.com/the-web-developer-bootcamp/learn/v4/questions/2788856
      var lat = data[0].latitude;
      var lng = data[0].longitude;
      var location = data[0].formattedAddress;

      Campground.findById(req.params.id, async function(err, campground) {
        if (err) {
          req.flash("error", err.message);
          res.redirect("back");
        } else {
          if (req.file) {
            try {
              await cloudinary.v2.uploader.destroy(campground.imageId);
              let result = await cloudinary.v2.uploader.upload(req.file.path);
              campground.imageId = result.public_id;
              campground.image = result.secure_url;
            } catch (err) {
              req.flash("error", err.message);
              return res.redirect("back");
            }
          }
          campground.name = req.body.campground.name;
          campground.description = req.body.campground.description;
          campground.price = req.body.campground.price;
          campground.location = location;
          campground.lat = lat;
          campground.lng = lng;
          campground.save();
          req.flash("success", "Successfully Updated!");
          res.redirect("/campgrounds/" + campground._id);
        }
      });
    });
  }
);

//DESTROY ROUTE
router.delete("/:id", middleware.checkCampgroundOwnership, function(req, res) {
  Campground.findById(req.params.id, async function(err, campground) {
    if (err) {
      req.flash("error", err.message);
      return res.redirect("/campgrounds");
    } 
    try {
      await cloudinary.v2.uploader.destroy(campground.imageId);
      campground.remove();
      req.flash("success", "Campground successfully deleted!");
      res.redirect("/campgrounds");
    } catch(err) {
        req.flash("error", err.message);
        return res.redirect("/campgrounds");
    }
  });
});

function escapeRegex(text) {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

module.exports = router;
