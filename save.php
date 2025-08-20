<?php
$body = file_get_contents("php://input");
$dec = json_decode($body);

if ($dec){
    file_put_contents("./save.json", json_encode($dec));
}
