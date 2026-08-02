
    var compare_universities = [];
    try {
        let stored = localStorage.getItem('compare_universities');
        if (stored) {
            compare_universities = JSON.parse(stored);
        }
    } catch(e) {
        console.error("Error reading compare_universities from localStorage", e);
    }
    var university_id = compare_universities.map(u => u.id);

    $(document).ready(function() {
        // Render initial state on load
        renderCompareRow();

        // Listen for Bootstrap modal close/open events to show/hide the floating compare button
        $('#fullscreenModal').on('show.bs.modal', function () {
            $('#floatingCompareBtn').removeClass('show');
        });

        $('#fullscreenModal').on('hidden.bs.modal', function () {
            let isOnComparePage = window.location.pathname.includes('compare');
            if (compare_universities.length > 0 && !isOnComparePage) {
                $('#floatingCompareBtn').addClass('show');
            }
        });

        // Handle university card redirect without conflicting with the compare button or other actions
        $(document).on('click', '.uni-card[data-url]', function(e) {
            if ($(e.target).closest('.compare-uni, .course-btn, a, button').length) {
                return;
            }
            var url = $(this).attr('data-url');
            if (url) {
                window.location.href = url;
            }
        });

        // Use event delegation so it works on dynamically filtered listings too
        $(document).on('click', '.compare-uni', function(e) {
            e.preventDefault();
            
            let uni_id = $(this).attr('data-id');
            let uni_name = $(this).attr('data-name');
            let logo = $(this).attr('data-logo');

            // If attributes are not present (fallback to DOM search)
            if (!uni_name || !logo) {
                let uni = $(this).closest('.uni-card');
                logo = $(uni).find('.uni-logo').attr('src');
                uni_name = $(uni).find('.uni-name').text();
            }

            if (!uni_id) return;

            // Check if already in the array
            let exists = compare_universities.some(u => u.id == uni_id);

            if (!exists) {
                if (compare_universities.length >= 3) {
                    alert('You can compare a maximum of 3 universities');
                    return;
                }
                
                compare_universities.push({
                    id: uni_id,
                    name: uni_name,
                    logo: logo
                });
                
                // Sync university_id array for compatibility with other APIs
                university_id = compare_universities.map(u => u.id);

                // Re-render and open modal
                renderCompareRow();
                $('#fullscreenModal').modal('show');
            } else {
                // If clicked again, remove it
                removeUniversity(uni_id);
            }
        });
    });

    // Global AJAX complete listener to sync compare button states after filtered content is loaded
    $(document).ajaxComplete(function() {
        if (typeof syncListingButtons === 'function') {
            syncListingButtons();
        }
    });

    function syncListingButtons() {
        $('.compare-uni').each(function() {
            let uni_id = $(this).attr('data-id');
            let exists = compare_universities.some(u => u.id == uni_id);
            if (exists) {
                $(this).addClass('active bg-success').removeClass('bg-primary').html('Added <i class="fas fa-check-circle"></i>');
            } else {
                $(this).removeClass('active bg-success').addClass('bg-primary').html('Compare <i class="fas fa-balance-scale"></i>');
            }
        });
    }

    function renderCompareRow() {
        // Save state to localStorage
        try {
            localStorage.setItem('compare_universities', JSON.stringify(compare_universities));
        } catch(e) {
            console.error("Error saving compare_universities to localStorage", e);
        }

        let html = '';
        for (let i = 0; i < 3; i++) {
            if (i < compare_universities.length) {
                let uni = compare_universities[i];
                html += `
                    <div class="col-md-4 col-sm-6 col-12">
                        <div class="compare-slot filled-slot" id="slot-uni-${uni.id}">
                            <button type="button" class="btn-remove-uni" onclick="removeUniversity('${uni.id}')" title="Remove">
                                <i class="fas fa-times"></i>
                            </button>
                            <div class="slot-logo-container">
                                <img src="${uni.logo}" alt="${uni.name}">
                            </div>
                            <p class="slot-title">${uni.name}</p>
                        </div>
                    </div>
                `;
            } else {
                html += `
                    <div class="col-md-4 col-sm-6 col-12">
                        <div class="compare-slot empty-slot" data-bs-dismiss="modal">
                            <div class="slot-icon">
                                <i class="fa-solid fa-plus text-muted"></i>
                            </div>
                            <p class="slot-text">Add to Compare</p>
                        </div>
                    </div>
                `;
            }
        }
        $('#compare-row').html(html);

        // Update modal title
        let count = compare_universities.length;
        let titleText = 'Select University to Compare';
        if (count > 0) {
            titleText = 'Compare ' + count + ' University' + (count > 1 ? 'ies' : '');
        }
        $('#fullscreenModalLabel').text(titleText);

        // Update compare button visibility
        if (count >= 2) {
            $('#compareNowButton').show();
        } else {
            $('#compareNowButton').hide();
        }

        // Update floating compare button
        let $floatBtn = $('#floatingCompareBtn');
        let $badge = $('#floatingCompareBadge');
        if ($badge.length) {
            $badge.text(count);
            // Trigger badge bump/pop animation
            $badge.removeClass('badge-bump').width(); // force reflow
            $badge.addClass('badge-bump');
        }

        // If modal is open, don't show the float button; show it only when closed
        let isModalOpen = $('#fullscreenModal').hasClass('show');
        let isOnComparePage = window.location.pathname.includes('compare');
        if (count > 0 && !isModalOpen && !isOnComparePage) {
            $floatBtn.addClass('show');
        } else {
            $floatBtn.removeClass('show');
        }

        // Update all listing buttons on current page to match new state
        syncListingButtons();
    }

    function removeUniversity(id) {
        // Filter out from the array
        compare_universities = compare_universities.filter(u => u.id != id);
        university_id = compare_universities.map(u => u.id);

        // Re-render slots (which will also save to localStorage and call syncListingButtons)
        renderCompareRow();
    }

    function clearAllCompare() {
        compare_universities = [];
        university_id = [];
        
        // Re-render slots (which will also save to localStorage and call syncListingButtons)
        renderCompareRow();
    }


    function CompareUniversity() {
        if (compare_universities.length < 2) {
            alert("Please select at least 2 universities to compare.");
            return;
        }

        $.ajax({
            url: '/compare-list',
            type: 'GET',
            data: {
                university_ids: university_id
            },
            beforeSend: function() {
                $('#loder').modal('show');
            },
            success: function(response) {
                if (response.status == 200) {
                    if (response.data.length >= 2 && response.data.length <= 3) {
                        let compareUrl = "/compare/" + response.data.join("/");
                        window.location.href = compareUrl;
                    } else {
                        alert("Please select at least 2 or at most 3 universities to compare.");
                    }
                }
            },
            error: function(xhr, status, error) {
                console.log('Error:', error);
            }
        });
    }
