require([
  '$api/models',
  '$views/list#List',
  '$api/toplists#Toplist',
  '$views/buttons'
  ], function(models, List, Toplist, buttons){
    'use strict';

  // Stored variables
  var $current = $('#cur'),
  $playList = $('#playlistContainer'),
  $loading = $('#loading'),
  $img = $('#img'),
  $desc = $('.desc'),
  $addBtn = $('.add'),
  tempList, 
  list, 
  curArtistName;


  // Event listener for when you drop an artist into the app
  function sidebarDropEventListener() {
    for(var i = 0; i < models.application.dropped.length; i++){
      var draggedItem = models.application.dropped[i];
      updateFromDragged(draggedItem.uri);
    }
  }

  // Clear out old tracks & build new tracks
  function updateFromDragged(droppedUri) {

    // Clear out old tracks
    tempList.tracks.clear().done(function(){

      //done clearing out tracks, so remove the old DOM elements
      $playList.find('.sp-list').remove();
    });

    // Remove the temporary ones not in use to reduce resource load
    models.Playlist.removeTemporary( models.Playlist.fromURI(tempList) );

    // If dropped item is an artist, get related / build
    if(droppedUri.indexOf('artist') >= 0) {
      getRelated(droppedUri);
    } else {
      console.warn('Dropped item is not an artist');
    }
  }

  // Get currently playing track
  function createListFromCurrentTrack(){


    var myPlayer = models.player;

    // Get the currently-playing track
    myPlayer.load('track').done(updateCurrentTrack);

    // Update the DOM when the song changes
    //myPlayer.addEventListener('change:track', updateCurrentTrack);
  }

  // Init drap/drop functionality
  function initDragDrop(){
    models.application.addEventListener('dropped', sidebarDropEventListener);
  }

  // Get the artist of the currently playing track & then build list
  function updateCurrentTrack(){

    if(models.player.track == null) {
      $current.text('No track currently playing');
    } else {
      var artists = models.player.track.artists,
      artists_array = [],
      artists_uri = [];

      var albums = models.player.track.album;

      for(var i = 0; i < artists.length; i++) {
        artists_array.push(artists[i].name);
        artists_uri.push(artists[i].uri);
      }

      // Pass the URI of the artist 
      getRelated(artists_uri[0]);
    }
  }

  // Build playlist
  function buildList(trackURIArray){

    var arr = trackURIArray;
    list = trackURIArray;

    models.Playlist
      // prevents appending new tracks on refresh
      .createTemporary("myTempList_" + new Date().getTime())
      .done(function (playlist){ 
        // Store created playlist, so that we can clear it out later
        tempList = playlist;

        // When all the tracks are finished loading
        playlist.load("tracks").done(function() {
          var playlistDesc = playlist.description;
          playlistDesc = "A playlist of top songs made from the related artists of " + curArtistName;
          $desc.text(playlistDesc);

          // Add tracks to list
          playlist.tracks.add.apply(playlist.tracks, arr).done(function(){
            // Create list
            var list = List.forCollection(playlist, {
              style: 'rounded'
            });
            // Hide loading
            $loading.hide();

            // Populate DOM
            $playList.append(list.node);
            list.init();
          });
        });
      });
  }

  // Add playlist to user's library
  function addPlayList() {

    $addBtn.on('click', function(e){
      e.preventDefault();

      var newPlayList = models.Playlist,
      newPlayListName = 'Related Songs from ' + curArtistName;

      newPlayList.create(newPlayListName).done(function (nPlaylist){
        nPlaylist.load('tracks').done(function(){
          nPlaylist.tracks.add(list);
        });
      });
    });
  }

  // Share out to the community
  // function initSharing(){
  //   $('.share').empty();
  //   var _playlistURI = models.Playlist.fromURI(greg);
  //   var shareBtn = buttons.ShareButton.forPlaylist(_playlistURI);
  //   $('.share').append(shareBtn.node);
  // }

  // Get top track
  function getTopTrack(artist, num) {
    var promise = new models.Promise();
    var artistTopList = Toplist.forArtist(artist);

    artistTopList.tracks.snapshot(0, num).done(function(snapshot) {
      snapshot.loadAll().done(function (tracks){
        promise.setDone(tracks[0]);
      }).fail(function(tracks){});
    });

    return promise;
  }

  // Get image from Artist URI
  function getImage(image_uri){

    models.Artist
    .fromURI(image_uri)
    .load('image')
    .done(function (img){

      var fullImgSrc = img.imageForSize(3000);
      
      // If image is undefined
      if(fullImgSrc) {
        // Generate new image and append to back
        $img.css('background-image', 'url('+ fullImgSrc +')');
      } else {
        //$img.addClass('img-undefined');
        console.log('image undefined')
      }

    }).fail(function (img){
      console.log('Failed to load image');
    });
  }

  // Get Related
  function getRelated(artist_uri){

    // get image
    getImage(artist_uri);

    models.Artist
    .fromURI(artist_uri)
    .load('related','name', 'image')
    .done(function (artist){

      // Store artist name to global var
      curArtistName = artist.name;

      // Populate DOM with current artist name
      $current.text(artist.name.decodeForText());

      artist.related.snapshot().done(function (snapshot){

        snapshot.loadAll().done(function (artists){

          var promises = [],
          filteredTracks;

          $loading.show();

          for(var i = 0; i < artists.length; i++){
            var promise = getTopTrack(artists[i], 1);
            promises.push(promise);
          }

          models.Promise.join(promises)
          .done(function (tracks){
           console.log('Loaded all tracks of ' + artist.name);
         })
          .fail(function (tracks){
           console.log('Failed to load at least one track.', tracks);
         }).always(function (tracks) {

              // Check to remove the top tracks that return undefined because their Promise failed
              filteredTracks = tracks.filter(function(t){
                return t !== undefined;
              });

              // filter out results from failed promises
              buildList(filteredTracks);
            });
       });
      });
    });

  }

  // Start off by building a list from the currently playing track
  createListFromCurrentTrack();

  // Add event listener for Drag/Drop
  initDragDrop();

  // Add playlist
  addPlayList();

});