function jx(data) {
	let n_data = (data.slice(0, 50)).reverse()
	let dom = document.querySelector('div[data-cenc]')
	n_data.forEach(e => {
		dom.insertAdjacentHTML('afterbegin', `<div class="card-list">
							<span>M${e.level}</span>
							<span>
								<span class="text">${e.location}</span>
							</span>
						</div>`)
	})

}