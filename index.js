#!/usr/bin/env node


const {
    h,
    render,
    renderToString,
    Component,
    Color,
    Fragment,
    Bold,
    span,
    div
} = require('ink');
const chalk = require('chalk');
const Gradient = require('ink-gradient');
const BigText = require('ink-big-text');
const Divider = require('ink-divider');
const Spinner = require('ink-spinner');
const fetch = require('node-fetch');
const addDays = require('date-fns/add_days');
const format = require('date-fns/format');

const ZESTY_ID = process.env.ZESTY_ID;
const ZESTY_ENDPOINT = 'https://api.zesty.com/client_portal_api';

const YELLOW = '#FFFFA5';
const GREEN = '#69FF94';
const BLUE = '#D6ACFF';
const RED = '#ffb3ba';

if (!ZESTY_ID) {
    console.log(chalk.hex(YELLOW)('Please set environment variable "ZESTY_ID" as your Zesty client id first.'));
    process.exit();
}

const getMealsByDate = (meals, startDate, endDate) => meals.filter(meal => {
    const date = new Date(meal.delivery_date);
    return date >= startDate && date <= endDate;
}).reduce((acc, meal) => {
    const date = new Date(meal.delivery_date);
    if (!acc[format(date, 'YYYY/MM/DD')]) {
        acc[format(date, 'YYYY/MM/DD')] = [];
    }
    acc[format(date, 'YYYY/MM/DD')].push(meal);
    return acc;
}, {});

class DayHeader extends Component {
    render() {
        const { date } = this.props;
        return h(Divider, {
            title: renderToString(h(
                Fragment,
                null,
                h(
                    Color,
                    { hex: YELLOW },
                    format(date, 'ddd'),
                    ' '
                ),
                h(
                    'span',
                    null,
                    format(date, 'MMM DD, YYYY')
                )
            ))
        });
    }
}

class MealView extends Component {
    render() {
        const { meal } = this.props;
        return h(
            'div',
            null,
            h(
                'span',
                null,
                format(meal.delivery_date, 'h:mma').padStart(10),
                ' | '
            ),
            h(
                Color,
                { hex: GREEN },
                meal.restaurant_name
            ),
            h(
                Color,
                { hex: BLUE },
                ' [',
                meal.restaurant_cuisine,
                ']'
            )
        );
    }
}

class Controls extends Component {
    constructor(props) {
        super(props);
        this.handleKeyPress = this.handleKeyPress.bind(this);
    }

    componentDidMount() {
        process.stdin.on('keypress', this.handleKeyPress);
    }

    componentWillUnmount() {
        process.stdin.removeListener('keypress', this.handleKeyPress);
    }

    handleKeyPress(_, key) {
        const { onPrev, onNext, prevEnabled, nextEnabled } = this.props;
        if (key.name === 'left' && prevEnabled) {
            onPrev();
        }
        if (key.name === 'right' && nextEnabled) {
            onNext();
        }
    }

    render() {
        const { prevEnabled, nextEnabled } = this.props;
        return h(
            'div',
            null,
            h(
                Color,
                { hex: prevEnabled && GREEN },
                '<'.padEnd(6)
            ),
            h(
                'span',
                null,
                '\'left\' and \'right\' to toggle through weeks'
            ),
            h(
                Color,
                { hex: nextEnabled && GREEN },
                '>'.padStart(6)
            )
        );
    }
}

class WeekTable extends Component {
    constructor(props) {
        super(props);
        this.state = {
            meals: [],
            weekOffset: 0
        };
    }

    componentWillMount() {
        const { zestyId } = this.props;
        this.setState({
            loading: true
        });
        const fetchMeals = fetch([ZESTY_ENDPOINT, 'meals'].join('/') + '?client_id=' + zestyId).then(res => res.json()).then(res => this.setState({
            meals: res.meals
        }));
        const fetchClient = fetch([ZESTY_ENDPOINT, 'clients', zestyId].join('/')).then(res => res.json()).then(res => this.setState({
            clientInfo: res.client
        }));
        Promise.all([fetchMeals, fetchClient]).then(() => this.setState({
            loading: false
        })).catch(err => {
            console.log(chalk.bold.hex(RED)('Something went wrong with the request to Zesty, check the error below to debug'));
            console.error(err);
            process.exit();
        });
    }

    render() {
        const { meals, clientInfo, loading, weekOffset } = this.state;
        const currentDate = addDays(new Date(), weekOffset * 7);
        currentDate.setHours(0, 0, 0, 0);
        const monday = new Date(currentDate);
        const sunday = new Date(currentDate);
        monday.setDate(currentDate.getDate() - currentDate.getDay());
        sunday.setDate(currentDate.getDate() + (7 - currentDate.getDay()));
        const mealsOfWeek = getMealsByDate(meals, monday, sunday);
        const weekKeys = Object.keys(mealsOfWeek);
        const firstMealsOfWeek = mealsOfWeek[weekKeys[0]];
        const lastMealsOfWeek = mealsOfWeek[weekKeys[weekKeys.length - 1]];
        if (loading) {
            return h(
                'div',
                null,
                h(Spinner, { green: true }),
                ' Loading Meals'
            );
        }
        return h(
            Fragment,
            null,
            clientInfo && h(
                Gradient,
                { name: 'pastel' },
                h(BigText, { text: clientInfo.name, font: 'chrome' })
            ),
            Object.keys(mealsOfWeek).map(key => {
                const mealsOfDay = mealsOfWeek[key];
                const date = new Date(key);
                return h(
                    Fragment,
                    null,
                    h(DayHeader, { date: date }),
                    h('br', null),
                    mealsOfDay.map(m => h(MealView, { meal: m })),
                    h('br', null)
                );
            }),
            h('br', null),
            h(Controls, {
                prevEnabled: (firstMealsOfWeek && firstMealsOfWeek[0].id) !== (meals[0] && meals[0].id),
                nextEnabled: (lastMealsOfWeek && lastMealsOfWeek[lastMealsOfWeek.length - 1].id) !== (meals[meals.length - 1] && meals[meals.length - 1].id),
                onPrev: () => this.setState({
                    weekOffset: this.state.weekOffset - 1
                }),
                onNext: () => this.setState({
                    weekOffset: this.state.weekOffset + 1
                })
            }),
            h('br', null)
        );
    }
}

render(h(WeekTable, { zestyId: ZESTY_ID }));
