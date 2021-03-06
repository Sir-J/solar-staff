import { Component, OnDestroy, OnInit } from '@angular/core';
import { Sort } from '@angular/material';
import { ActivatedRoute } from '@angular/router';
import { BaseCurrencyDto, FilterDto, RateDto } from 'app/models/classes';
import { ExchangeRateService } from 'app/services';
import { BlockUI, NgBlockUI } from 'ng-block-ui';
import { ToastrService } from 'ngx-toastr';
import { Subject, throwError } from 'rxjs';
import { catchError, debounceTime, finalize, takeUntil } from 'rxjs/operators';

@Component({
    selector: 'app-default-page',
    templateUrl: './default-page.component.html',
    styleUrls: ['./default-page.component.less']
})
export class DefaultPageComponent implements OnInit, OnDestroy {
    private ngUnsubscribe: Subject<void> = new Subject<void>();

    filter: FilterDto = new FilterDto();
    mainCurrencies: Array<string> = new Array<string>();
    secondCurrencies: Array<string> = new Array<string>();
    model: BaseCurrencyDto;
    sortRates: Array<RateDto>;
    minDate = new Date(1999, 4, 1);
    maxDate = new Date();

    showSelectedRates = new Subject();

    @BlockUI()
    blockUI: NgBlockUI;

    constructor(private route: ActivatedRoute, private service: ExchangeRateService, private toastr: ToastrService) {}

    ngOnInit() {
        this.model = this.route.snapshot.data['baseRate'] as BaseCurrencyDto;
        this.mainCurrencies = this.model.rates.map((rate: RateDto) => rate.name);
        this.secondCurrencies = this.model.rates.map((rate: RateDto) => rate.name);
        this.sortRates = this.model.rates.slice();
        if (this.mainCurrencies.indexOf(this.model.base) === -1) {
            this.mainCurrencies.push(this.model.base);
            this.mainCurrencies.sort();
        }
        this.filter.currency = this.model.base;

        this.showSelectedRates
            .pipe(
                takeUntil(this.ngUnsubscribe),
                debounceTime(2000)
            )
            .subscribe(() => {
                this.search();
            });
    }

    changeFilterRates(): void {
        this.showSelectedRates.next();
    }

    sortData(sort: Sort) {
        const data = this.model.rates.slice();
        if (!sort.active || sort.direction === '') {
            this.sortRates = data;
            return;
        }

        this.sortRates = data.sort((item1: RateDto, item2: RateDto) => {
            const isAsc = sort.direction === 'asc' || sort.direction === '';
            switch (sort.active) {
                case 'name':
                    return this.compare(item1.name, item2.name, isAsc);
                case 'rate':
                    return this.compare(item1.rate, item2.rate, isAsc);
                default:
                    return 0;
            }
        });
    }

    private compare(a: number | string, b: number | string, isAsc: boolean) {
        return (a < b ? -1 : 1) * (isAsc ? 1 : -1);
    }

    search(): void {
        this.blockUI.start();
        this.service
            .getBaseRate(this.filter.currency, this.filter.date, this.filter.rates)
            .pipe(
                takeUntil(this.ngUnsubscribe),
                catchError(error => this.catchErrorFn(error)),
                finalize(() => this.blockUI.stop())
            )
            .subscribe((newModel: BaseCurrencyDto) => {
                this.model = newModel;
                this.sortRates = this.model.rates.slice();
                if (this.mainCurrencies.indexOf(this.model.base) === -1) {
                    this.mainCurrencies.push(this.model.base);
                    this.mainCurrencies.sort();
                }
                this.filter.currency = this.model.base;
            });
    }

    protected catchErrorFn(error: any) {
        this.toastr.error('Ошибка загрузки данных');
        return throwError(error);
    }

    ngOnDestroy(): void {
        this.ngUnsubscribe.next();
        this.ngUnsubscribe.complete();
    }
}
