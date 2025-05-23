const TIMES = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00', '20:30', '21:00'
];

$(document).ready(function () {
    setupNavigation();

    // אם יש טופס להוספת חדרים
    if ($('#roomNameInput').length) setupRoomNameForm();

    // אם יש גריד של חדרים
    if ($('#room-grid').length) initHome();

    if ($('#scheduleTable').length) initSchedule();
    if ($('#roomForm').length) initRoomForm();
    if ($('#messageList').length) displayLast10Messages();
});

function setupNavigation() {
    $('#nav-schedule').click(() => { window.location.href = '/room-schedule'; });
    $('#nav-edit').click(() => { window.location.href = '/room-form'; });
    $('#nav-messages').click(() => { window.location.href = '/messages'; });
    $('#nav-signout').click(() => {
        Swal.fire({
            title: 'להתנתק?',
            showCancelButton: true,
            confirmButtonText: 'כן',
            cancelButtonText: 'לא'
        }).then(r => { if (r.isConfirmed) window.location.href = '/logout'; });
    });
    $('#backHome').click(() => { window.location.href = '/home'; });
}

// טופס לבחירת שמות חדרים
function setupRoomNameForm() {
    const rooms = [];

    $('#addRoomBtn').click(function () {
        const room = $('#roomNameInput').val().trim();
        if (!room) return;
        rooms.push(room);
        $('#roomList').append(`<li class="list-group-item">${room}</li>`);
        $('#roomNameInput').val('');
    });

    $('#submitRoomsBtn').click(function () {
        if (rooms.length === 0) {
            return Swal.fire('לא הוזנו חדרים');
        }

        fetch('/saveRooms', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ rooms })
        }).then(res => {
            if (res.ok) {
                Swal.fire('החדרים נשמרו', '', 'success').then(() => {
                    location.reload();
                });
            } else {
                Swal.fire('שגיאה בשמירת החדרים');
            }
        });
    });
}

function initHome() {
    fetch('/getRooms')
        .then(res => res.json())
        .then(rooms => {
            if (!rooms || rooms.length === 0) return;

            $('#roomSetupForm').hide(); // הסתרת טופס אם יש חדרים

            const $grid = $('#room-grid').empty();
            rooms.forEach(label => {
                $grid.append(`
                    <div class="room" data-room-number="${label}">
                        <div class="room-number">${label}</div>
                    </div>
                `);
            });

            $('.room').click(function () {
                const room = $(this).data('room-number');
                window.location.href = `/room/${room}`;
            });
        });
}

function initSchedule() {
    const today = moment().format('YYYY-MM-DD');
    $('#lookupDate')
        .val(today)
        .off('change')
        .on('change', fetchDataByDate);
    fetchDataByDate();
}

function fetchDataByDate() {
    const date = $('#lookupDate').val();
    fetch(`/fetchDataByDate?date=${encodeURIComponent(date)}`, {
        headers: { Accept: 'application/json' }
    })
        .then(r => (r.ok ? r.json() : Promise.reject(r.status)))
        .then(updateScheduleGrid)
        .catch(() => Swal.fire('שגיאה בטעינת נתוני החדרים'));
}

function updateScheduleGrid(rows) {
    $('#scheduleTable td.grid-cell').removeAttr('style').empty();
    (rows || []).forEach(r => {
        const $cells = $('#scheduleTable td.grid-cell').filter(function () {
            const [room, time] = $(this).data('room-hour').split(' ');
            return (
                room === String(r.roomNumber) &&
                time >= r.startTime &&
                time < r.endTime
            );
        });

        $cells.css({
            backgroundColor: r.color,
            border: `2px solid ${r.color}`
        });

        const $middle = $cells.eq(Math.floor($cells.length / 2));
        $middle.html(`<div class="therapist-name">${r.names}</div>`);

        $cells
            .attr('title', `מטפל/ת: ${r.names}\nחדר: ${r.roomNumber}`)
            .tooltip()
            .off('click')
            .on('click', () => {
                Swal.fire({
                    title: 'האם להסיר פגישה זו?',
                    showCancelButton: true,
                    confirmButtonText: 'כן',
                    cancelButtonText: 'לא'
                }).then(res => {
                    if (res.isConfirmed) {
                        deleteEntry($('#lookupDate').val(), r.roomNumber, r.startTime, r.endTime)
                            .then(fetchDataByDate);
                    }
                });
            });
    });
}

function deleteEntry(date, room, start, end) {
    return fetch('/deleteEntry', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            selected_date: date,
            roomNumber: room,
            startTime: start,
            endTime: end
        })
    });
}

function initRoomForm() {
    const $start = $('#startTime').empty();
    TIMES.forEach(t => $start.append(`<option value="${t}">${t}</option>`));
    $start.change(updateEndTimeOptions);
    updateEndTimeOptions();

    $('#recurringEvent').change(() => {
        $('#recurringOptions').css(
            'visibility',
            $('#recurringEvent').is(':checked') ? 'visible' : 'hidden'
        );
    });

    $('#roomForm').submit(async e => {
        e.preventDefault();
        const data = {
            selectedDate: $('#selectedDate').val(),
            names: $('#names').val(),
            selectedColor: $('#selectedColor').val(),
            startTime: $('#startTime').val(),
            endTime: $('#endTime').val(),
            roomNumber: $('#roomNumber').val(),
            recurringEvent: $('#recurringEvent').is(':checked'),
            recurringNum: $('#recurringNum').val()
        };

        if (data.names.trim() === "פנוי") {
            const messageInput = `חדר ${data.roomNumber} פנוי בתאריך ${data.selectedDate} בשעות ${data.startTime} - ${data.endTime}`;
            await fetch('/submit_message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: messageInput })
            });
        }

        await fetch('/submit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        Swal.fire('נשמר!', '', 'success');
        $('#roomForm')[0].reset();
        updateEndTimeOptions();
    });
}

function updateEndTimeOptions() {
    const s = $('#startTime').val();
    const valid = TIMES.filter(t =>
        moment(t, 'HH:mm').isAfter(moment(s, 'HH:mm'))
    );
    $('#endTime').empty().append(valid.map(t => `<option>${t}</option>`));
}

function displayLast10Messages() {
    fetch('/get_last_messages')
        .then(r => r.json())
        .then(data => {
            const list = $('#messageList').empty();
            data.messages.forEach((msg, i) => {
                const item = $(`<div class="item list-group-item animate__fadeInRight" data-index="${i}"><div>${msg}</div></div>`);
                const check = $('<i class="fas fa-check-square" style="color:lightgray;"></i>')
                    .click(() => check.css('color', 'limegreen'));
                const trash = $('<i class="fas fa-trash" style="color:darkgray;"></i>')
                    .click(() => deleteMessage(data.messageIds[i], item));
                item.append($('<div>').append(check, trash));
                list.append(item);
            });
        });
}

function submitMessage() {
    const input = $('#input').val().trim();
    if (!input) return Swal.fire('אי אפשר לשלוח הודעה ריקה');
    fetch('/submit_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
    })
        .then(r => r.json())
        .then(res => {
            const item = $(`<div class="item animate__animated animate__bounce"><div>${input}</div></div>`)
                .attr('data-id', res.messageId);
            const check = $('<i class="fas fa-check-square" style="color:lightgray;"></i>')
                .click(() => check.css('color', 'limegreen'));
            const trash = $('<i class="fas fa-trash" style="color:darkgray;"></i>')
                .click(() => deleteMessage(res.messageId, item));
            item.append($('<div>').append(check, trash));
            $('#messageList').prepend(item);
            $('#input').val('');
        });
}

function deleteMessage(messageId, item) {
    fetch('/delete_message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId })
    }).then(r => {
        if (r.ok) {
            item.addClass('animate__slideOutLeft');
            setTimeout(() => item.remove(), 1000);
        } else {
            Swal.fire('שגיאה במחיקת ההודעה');
        }
    });
}
