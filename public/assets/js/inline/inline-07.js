
    function updateFeeValue() {
        const slider = document.getElementById('fee_slider');
        const feeValue = document.getElementById('feeValue');

        feeValue.innerText = new Intl.NumberFormat().format(slider.value);
    }

    updateFeeValue();
