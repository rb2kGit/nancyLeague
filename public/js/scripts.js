function labelInput(){
    document.getElementById("matchLabel").innerHTML = document.getElementById("matchRange").value;
}

function packLabelInput(){
    document.getElementById("packAmount").innerHTML = document.getElementById("packNumber").value;
    document.getElementById("packCost").innerHTML = document.getElementById("packNumber").value * 100;
}