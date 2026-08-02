document.querySelectorAll('[data-bs-toggle="tab"]').forEach(function(btn) {
        btn.addEventListener('click', function() {
            const tabList = this.closest('[role="tablist"]');
            if (tabList) {
                tabList.querySelectorAll('[data-bs-toggle="tab"]').forEach(function(b) {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                this.classList.add('active');
                this.setAttribute('aria-selected', 'true');
            }
        });
    });