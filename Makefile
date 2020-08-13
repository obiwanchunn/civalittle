pull:
	rsync -azP adam@mcdillers.com:/home/adam/projects/civalittle/. /home/Adam/projects/civalittle

push:
	rsync -azP /home/Adam/projects/civalittle/. adam@mcdillers.com:/home/adam/projects/civalittle

adamhula:
	curl -X 'POST' 'http://civadam.mcdillers.com/' -H 'connection: close' -H 'content-type: application/json' -d $'{"value1":"Hulahoop Game","value2":"adam","value3":"46"}'
