
    document.addEventListener('DOMContentLoaded', function() {
        var searchTrigger = document.querySelector('.search-trigger-active');
        if (searchTrigger) {
            searchTrigger.addEventListener('click', function() {
                setTimeout(function() {
                    var searchInput = document.getElementById('bannerSearch');
                    if (searchInput) {
                        searchInput.focus();
                    }
                }, 200); // Slight delay allows animation to finish before focusing
            });
        }
    });
