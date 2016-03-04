// common events
//
if ( ReviewImproved.enabled() ) {

    // Globally reusable functions
    $.extend(ReviewImproved, {

        // Global vars: TODO: find a way to remove the need for these
        currentHiglight : null,
        modal : null,
        lastSelection : null,

        commentsLoaded : function(event, issue) {
            ReviewImproved.renderCommentList( issue );
        },

        // TODO: rerender issue detail instead
        renderCommentList : function( issue ) {
            var selector = sprintf(
                '[data-issue-id=%s] [data-mount=issue-comments]:visible',
                issue.id
            );
            var mount_point = $( selector );
            if ( mount_point.length == 0 ) return;

            var comments = MateCat.db.segment_translation_issue_comments.
                findObjects({ 'id_issue': issue.id });

            var data = {
                loading : false,
                comments : _.sortBy(comments, 'created_at')
            };
            var tpl = template('review_improved/issue_comments', data);
            mount_point.html(tpl);
        },

        getSegmentRecord : function( segment ) {
            return MateCat.db.segments
                .findObject({sid : segment.id });
        },

        getTranslationText : function( segment ) {
            var record = ReviewImproved.getSegmentRecord( segment );
            var version;
            var revertingVersion = segment.el.data('revertingVersion');

            if ( revertingVersion ) {
                version = MateCat.db.segment_versions.findObject({
                    id_segment : record.sid,
                    version_number : revertingVersion + ''
                });
                return version.translation ;
            }
            else {
                return record.translation ;
            }
        },

        showIssueDetailModalWindow : function( issue ) {

            $(document).one('closed', '.remodal', function() {
                ReviewImproved.modal.destroy();
            });

            $(document).one('opened', '.remodal', function() {
                var issue_comments = sprintf(
                    '/api/v2/jobs/%s/%s/segments/%s/translation/issues/%s/comments',
                    config.id_job, config.password,
                    issue.id_segment,
                    issue.id
                );

                // ReviewImproved.renderCommentList( issue );
                $.getJSON(issue_comments).done(function(data) {
                    $.each( data.comments, function( comment ) {
                        MateCat.db.upsert('segment_translation_issue_comments', 'id', _.clone(this) );
                    });
                    $(document).trigger('issue_comments:load', issue);
                });
            });

            var tpl_data = { loading: true, issue: issue };
            var tpl = template('review_improved/issue_detail_modal', tpl_data);

            ReviewImproved.modal = tpl.remodal({});

            tpl.on('keydown', function(e)  {
                var esc = 27 ;
                e.stopPropagation();
                if ( e.which == esc ) {
                    ReviewImproved.modal.close();
                }
            });

            ReviewImproved.modal.open();
        },

        updateIssueViews : function( segment ) {
            var targetVersion = segment.el.data('revertingVersion');
            var record = MateCat.db.segments.by('sid', segment.id );
            var version = (targetVersion == null ? record.version_number : targetVersion) ;
            var issues = MateCat.db.segment_translation_issues;
            var current_issues = issues.findObjects({
                id_segment : record.sid, translation_version : version
            });

            var data = {
                issues : current_issues,
                isReview : config.isReview
            };

            var tpl = template('review_improved/translation_issues', data );

            tpl.find('.issue-container').on('mouseenter', ReviewImproved.highlightIssue);
            tpl.find('.issue-container').on('mouseleave', ReviewImproved.resetHighlight);

            UI.Segment.findEl( record.sid ).find('[data-mount=translation-issues]').html( tpl );
        },

        // highlightIssue : function(e) {
        //     var container = $(e.target).closest('.issue-container');
        //     var issue = MateCat.db.segment_translation_issues.findObject({
        //         id : container.data('issue-id') + ''
        //     });
        //     var segment = MateCat.db.segments.findObject({sid : issue.id_segment});

        //     // TODO: check for this to be really needed
        //     if ( container.data('current-issue-id') == issue.id ) {
        //         return ;
        //     }

        //     // TODO: check for this to be really needed
        //     container.data('current-issue-id', issue.id);
        //     var selection = document.getSelection();
        //     selection.removeAllRanges();

        //     var area = container.closest('section').find('.issuesHighlightArea') ;

        //     // TODO: fix this to take into account cases when monads are in place
        //     var contents       = area.contents() ;
        //     var range = document.createRange();

        //     range.setStart( contents[ issue.start_node ], issue.start_offset );
        //     range.setEnd( contents[ issue.end_node ], issue.end_offset );

        //     selection.addRange( range );
        // },

        // resetHighlight : function(e) {
        //     var selection = document.getSelection();
        //     selection.removeAllRanges();

        //     var segment = new UI.Segment( $(e.target).closest('section'));
        //     var container = $(e.target).closest('.issue-container');

        //     container.data('current-issue-id', null) ; // TODO: check for this to be really needed

        //     var section = container.closest('section');

        //     var area = section.find('.issuesHighlightArea') ;
        //     var issue = MateCat.db.segment_translation_issues.findObject({
        //         id : container.data('issue-id') + ''
        //     });
        //     area.html(
        //         UI.decodePlaceholdersToText(
        //             ReviewImproved.getTranslationText( segment )
        //         )
        //     );
        // },
    });

    $(document).on('issue_comments:load', ReviewImproved.commentsLoaded);

    $(document).on('files:appended', function initReactComponents() {
        loadDataPromise.done(function() {
            $('section [data-mount=translation-issues-button]').each(function() {
                ReactDOM.render( React.createElement( TranslationIssuesSideButton, {
                        sid : $(this).data('sid')
                    } ), this );
            });
        });
    });

    var putSegmentsInStore = function(data) {
        $.each(data.files, function() {
            $.each( this.segments, function() {
                MateCat.db.upsert( 'segments', 'sid', _.clone( this ) );
            });
        });
    }

    $(document).on('ready', function() {
        ReviewImproved.mountPanelComponent();
    });

    $(document).on('segments:load', function(e, data) {
        putSegmentsInStore( data );
    });

    var updateLocalTranslationVersions = function( data ) {
        $(data.versions).each(function() {
            MateCat.db.upsert('segment_versions', 'id', this ) ;
        });
    };

    var loadDataPromise = (function() {
        var issues =  sprintf(
            '/api/v2/jobs/%s/%s/translation-issues',
            config.id_job, config.password
        );

        var versions =  sprintf(
            '/api/v2/jobs/%s/%s/translation-versions',
            config.id_job, config.password
        );

        return $.when(
            $.getJSON( issues ).done(function( data ) {
                $(data.issues).each(function() {
                    MateCat.db.upsert('segment_translation_issues',
                                  'id', this ) ;
                });
            }),

            // jQuery oddity here: function must be passed in array,
            // maybe because we are inside when. Otherwise it doesn't get
            // fired.
            $.getJSON( versions ).done( [ updateLocalTranslationVersions ] )
        );
    })();

    $(document).on('click', '.action-view-issue', function(e) {
        var container =  $(e.target).closest('.issue-container') ;
        var issue = MateCat.db.segment_translation_issues
            .by('id',container.data('issue-id'));
        ReviewImproved.showIssueDetailModalWindow( issue );
    });

    $(document).on('click', 'input[data-action=submit-issue-reply]', function(e) {

        var container = $(e.target).closest('.issue-detail-modal');
        var issue = MateCat.db.segment_translation_issues
            .by('id', container.data('issue-id'));

        var data = {
          message : $('[data-ui=issue-reply-message]').val(),
          source_page : config.isReview
        };

        ReviewImproved.submitComment( data );

    });

    $(window).on('segmentClosed', function( e ) {
        // ReviewImproved.closePanel();
    });

    $( document ).on( 'keydown', function ( e ) {
        var esc = '27' ;
        if ( e.which == esc ) {
            ReviewImproved.closePanel();
        }
    });

    $('#review-side-panel .review-issue-comments-buttons-right a')
        .on('click', function(e) { e.stopPropagation();  });

    $(document).on('translation:change', function(e, data) {
        var versions_path =  sprintf(
            '/api/v2/jobs/%s/%s/segments/%s/translation-versions',
            config.id_job, config.password, data.sid
        );

        $.getJSON( versions_path ).done( updateLocalTranslationVersions );
    });

}